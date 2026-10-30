const { db, ok } = require('../lib/supabase');
const { ADMIN_EMAIL, signToken, verifyGoogleAccessToken } = require('../lib/auth');

module.exports = {
  // POST /api/auth/google  { accessToken }  → { token, email, role, points }
  google: async (req, res) => {
    try {
      const { accessToken } = req.body || {};
      if (!accessToken) return res.status(400).json({ error: 'accessToken is required' });

      let g;
      try { g = await verifyGoogleAccessToken(accessToken); }
      catch (e) { return res.status(401).json({ error: 'Google verification failed: ' + e.message }); }

      const banned = ok(await db().from('banned_emails').select('email').eq('email', g.email).maybeSingle());
      if (banned) return res.status(403).json({ error: 'This account has been banned and cannot sign in.', banned: true });

      const isAdmin = g.email === ADMIN_EMAIL;
      let user = ok(await db().from('users').select('*').eq('email', g.email).maybeSingle());
      if (!user) {
        user = ok(await db().from('users').insert({
          email: g.email, username: g.name || g.email.split('@')[0], avatar: g.picture || null,
          role: isAdmin ? 'admin' : 'user', login_count: 1, last_login: new Date().toISOString(),
        }).select().single());
      } else {
        user = ok(await db().from('users').update({
          login_count: (user.login_count || 0) + 1, last_login: new Date().toISOString(),
          ...(isAdmin ? { role: 'admin' } : {}),
        }).eq('id', user.id).select().single());
      }
      res.json({ token: signToken(user), email: user.email, role: user.role, points: Number(user.points) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
};
