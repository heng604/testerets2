const { v4: uuidv4 } = require('uuid');
const { db, ok, fetchAll } = require('../lib/supabase');
const { toReport } = require('../lib/mappers');

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { res.status(500).json({ error: e.message }); }
};
const iso = (d) => (d ? new Date(d).toISOString() : '');

module.exports = {
  createReport: wrap(async (req, res) => {
    const { userEmail, username, subject, category, message } = req.body || {};
    if (!userEmail || !subject || !message) return res.status(400).json({ error: 'userEmail, subject, and message are required' });
    const cat = ['bug', 'payment', 'product', 'account', 'other'].includes(category) ? category : 'other';
    const row = ok(await db().from('reports').insert({
      report_id: uuidv4(), user_email: userEmail, username: username || userEmail.split('@')[0],
      subject, category: cat, message,
    }).select().single());
    res.status(201).json({ success: true, report: toReport(row) });
  }),

  getReportsByEmail: wrap(async (req, res) => {
    const rows = ok(await db().from('reports').select('*').eq('user_email', decodeURIComponent(req.params.email)).order('timestamp', { ascending: false }));
    res.json(rows.map(toReport));
  }),

  getAllReports: wrap(async (req, res) => {
    const rows = ok(await db().from('reports').select('*').order('timestamp', { ascending: false }));
    res.json(rows.map(toReport));
  }),

  updateReport: wrap(async (req, res) => {
    const { status, adminNote } = req.body || {};
    const upd = {};
    if (status) upd.status = status;
    if (adminNote !== undefined) upd.admin_note = adminNote;
    if (status === 'resolved' || status === 'closed') upd.resolved_at = new Date().toISOString();
    const rows = ok(await db().from('reports').update(upd).eq('report_id', req.params.reportId).select());
    if (!rows.length) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true, report: toReport(rows[0]) });
  }),

  exportData: wrap(async (req, res) => {
    const type = req.params.type; // users | orders | payments | reports | all
    const all = type === 'all';
    const out = {};

    if (type === 'users' || all) {
      const users = await fetchAll(() => db().from('users').select('*').order('created_at', { ascending: false }));
      const deps = await fetchAll(() => db().from('deposits').select('user_email,amount'));
      const dm = {};
      deps.forEach((d) => { const x = dm[d.user_email] || (dm[d.user_email] = { n: 0, sum: 0 }); x.n++; x.sum += Number(d.amount); });
      out.users = users.map((u) => ({
        email: u.email, username: u.username, role: u.role, points: Number(u.points), loginCount: u.login_count || 0,
        lastLogin: iso(u.last_login), createdAt: iso(u.created_at),
        totalTopups: (dm[u.email] || {}).n || 0, totalTopupAmount: (dm[u.email] || {}).sum || 0,
      }));
    }
    if (type === 'orders' || all) {
      const ps = await fetchAll(() => db().from('purchases').select('*, mods(title)').order('purchased_at', { ascending: false }));
      out.orders = ps.map((p) => ({
        purchaseId: p.id, userEmail: p.user_email, product: (p.mods && p.mods.title) || p.mod_id,
        pointsSpent: Number(p.points_spent), purchasedAt: iso(p.purchased_at),
      }));
    }
    if (type === 'payments' || all) {
      const ds = await fetchAll(() => db().from('deposits').select('*').order('timestamp', { ascending: false }));
      out.payments = ds.map((d) => ({
        depositId: d.deposit_id, userEmail: d.user_email, method: d.method, amount: Number(d.amount),
        status: d.status, timestamp: iso(d.timestamp),
      }));
    }
    if (type === 'reports' || all) {
      const rs = await fetchAll(() => db().from('reports').select('*').order('timestamp', { ascending: false }));
      out.reports = rs.map((r) => ({
        reportId: r.report_id, userEmail: r.user_email, username: r.username, subject: r.subject, category: r.category,
        message: r.message, status: r.status, adminNote: r.admin_note, timestamp: iso(r.timestamp), resolvedAt: iso(r.resolved_at),
      }));
    }
    res.json(out);
  }),
};
