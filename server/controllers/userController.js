const { db, ok, fetchAll } = require('../lib/supabase');
const { toUser, toBanned } = require('../lib/mappers');
const { ADMIN_EMAIL } = require('../lib/auth');

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Atomic +/- on points. Returns updated user row or null (missing user / not enough points).
async function adjustPoints(email, delta) {
  const rows = ok(await db().rpc('adjust_points', { p_email: email, p_delta: delta }));
  return rows && rows[0] ? rows[0] : null;
}

module.exports = {
  adjustPoints,

  getAllUsers: wrap(async (req, res) => {
    const users = await fetchAll(() => db().from('users').select('*').order('created_at', { ascending: false }));
    const deps = await fetchAll(() => db().from('deposits').select('user_email,amount'));
    const dm = {};
    deps.forEach((d) => { const x = dm[d.user_email] || (dm[d.user_email] = { n: 0, sum: 0 }); x.n++; x.sum += Number(d.amount); });
    res.json(users.map((u) => ({ ...toUser(u), totalTopups: (dm[u.email] || {}).n || 0, totalTopupAmount: (dm[u.email] || {}).sum || 0 })));
  }),

  deleteUser: wrap(async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const gone = ok(await db().from('users').delete().eq('email', email).select('id'));
    if (!gone.length) return res.status(404).json({ error: 'User not found' });
    ok(await db().from('deposits').delete().eq('user_email', email));
    ok(await db().from('banned_emails').upsert({ email, reason: 'Deleted by admin', banned_at: new Date().toISOString() }, { onConflict: 'email' }));
    res.json({ success: true, email });
  }),

  unbanUser: wrap(async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const gone = ok(await db().from('banned_emails').delete().eq('email', email).select('id'));
    if (!gone.length) return res.status(404).json({ error: 'Email is not banned' });
    res.json({ success: true, email });
  }),

  getBannedUsers: wrap(async (req, res) => {
    res.json(ok(await db().from('banned_emails').select('*').order('banned_at', { ascending: false })).map(toBanned));
  }),

  updateUser: wrap(async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const { points, role } = req.body || {};
    const upd = {};
    if (points !== undefined) {
      const p = parseFloat(points);
      if (isNaN(p) || p < 0) return res.status(400).json({ error: 'points must be a non-negative number' });
      upd.points = p;
    }
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: "role must be 'user' or 'admin'" });
      upd.role = role;
    }
    const rows = ok(await db().from('users').update(upd).eq('email', email).select());
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: toUser(rows[0]) });
  }),

  deductPointsByEmail: wrap(async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const amount = parseFloat(req.body && req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
    const u = await adjustPoints(email, -amount);
    if (!u) return res.status(400).json({ error: 'User not found or insufficient points' });
    res.json({ email: u.email, points: Number(u.points) });
  }),

  updateAvatar: wrap(async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const { avatar } = req.body || {};
    if (!avatar) return res.status(400).json({ error: 'avatar is required' });
    const rows = ok(await db().from('users').update({ avatar }).eq('email', email).select('email,avatar'));
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  }),

  getAvatar: wrap(async (req, res) => {
    const u = ok(await db().from('users').select('avatar').eq('email', decodeURIComponent(req.params.email)).maybeSingle());
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json({ avatar: u.avatar || null });
  }),

  // Login-time lookup: ban checks + auto-create user. (Admin *power* now comes from the JWT, not this reply.)
  getPointsByEmail: wrap(async (req, res) => {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const isSessionCheck = req.query.check === 'session';
    const THRESH = 5, WINDOW = 10 * 60 * 1000, LOCK = 30 * 60 * 1000;

    const banned = ok(await db().from('banned_emails').select('*').eq('email', email).maybeSingle());
    if (banned) {
      const now = new Date();
      if (banned.locked_until && new Date(banned.locked_until) > now) {
        return res.status(429).json({ error: 'Too many login attempts on a banned account. Try again later.', banned: true, locked: true,
          secondsLeft: Math.ceil((new Date(banned.locked_until) - now) / 1000) });
      }
      if (isSessionCheck) return res.status(403).json({ error: 'This account has been banned and cannot sign in.', banned: true });

      const within = banned.last_attempt_at && now - new Date(banned.last_attempt_at) < WINDOW;
      const count = within ? banned.attempt_count + 1 : 1;
      const upd = { attempt_count: count, last_attempt_at: now.toISOString() };
      if (count >= THRESH) { upd.locked_until = new Date(now.getTime() + LOCK).toISOString(); upd.attempt_count = 0; }
      await db().from('banned_emails').update(upd).eq('email', email);
      if (upd.locked_until) return res.status(429).json({ error: 'Too many login attempts on a banned account. Try again later.', banned: true, locked: true, secondsLeft: LOCK / 1000 });
      return res.status(403).json({ error: 'This account has been banned and cannot sign in.', banned: true });
    }

    const isAdmin = email === ADMIN_EMAIL;
    let user = ok(await db().from('users').select('*').eq('email', email).maybeSingle());
    if (!user) {
      const ins = await db().from('users').insert({ email, username: email.split('@')[0], points: 0, role: isAdmin ? 'admin' : 'user', login_count: 1, last_login: new Date().toISOString() }).select().single();
      if (ins.error && ins.error.code !== '23505') throw new Error(ins.error.message);
      user = ins.data || ok(await db().from('users').select('*').eq('email', email).single());
    } else if (!isSessionCheck) {
      user = ok(await db().from('users').update({ login_count: (user.login_count || 0) + 1, last_login: new Date().toISOString(), ...(isAdmin ? { role: 'admin' } : {}) }).eq('id', user.id).select().single());
    }
    res.json({ email: user.email, points: Number(user.points), role: user.role });
  }),
};
