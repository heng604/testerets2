const { db, ok } = require('../lib/supabase');
const { toDeposit } = require('../lib/mappers');
const { creditPoints } = require('../lib/bakong');

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = {
  createDepositRequest: wrap(async (req, res) => {
    const { method, amount, slipUrl, userEmail } = req.body || {};
    if (!userEmail) return res.status(400).json({ error: 'userEmail is required' });
    if (!slipUrl) return res.status(400).json({ error: 'slipUrl is required' });
    if (!amount || isNaN(amount)) return res.status(400).json({ error: 'amount must be a number' });
    const depositId = `DEP-${Math.floor(1000 + Math.random() * 9000)}-${Date.now()}`;
    const row = ok(await db().from('deposits').insert({
      deposit_id: depositId, user_email: userEmail, method: method || 'Unknown',
      amount: parseFloat(amount), slip_url: slipUrl, status: 'pending', source: 'manual',
    }).select().single());
    res.status(201).json({ success: true, deposit: toDeposit(row) });
  }),

  getPendingDeposits: wrap(async (req, res) => {
    const rows = ok(await db().from('deposits').select('*').eq('status', 'pending').neq('source', 'bakong').order('timestamp', { ascending: false }));
    res.json(rows.map(toDeposit));
  }),

  getBakongDeposits: wrap(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const rows = ok(await db().from('deposits').select('*').eq('source', 'bakong').order('timestamp', { ascending: false }).limit(limit));
    res.json(rows.map(toDeposit));
  }),

  verifyDeposit: wrap(async (req, res) => {
    const { action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: "action must be 'approve' or 'reject'" });

    const existing = ok(await db().from('deposits').select('*').eq('deposit_id', req.params.depositId).maybeSingle());
    if (!existing) return res.status(404).json({ error: 'Deposit not found' });
    if (existing.source === 'bakong') return res.status(400).json({ error: 'This is a Bakong auto top-up — it is verified automatically and cannot be manually approved or rejected.' });
    if (existing.status !== 'pending') return res.status(400).json({ error: `This deposit was already ${existing.status}.` });

    const status = action === 'approve' ? 'approved' : 'rejected';
    let pointsToAdd = null, pointRate = null;

    if (status === 'approved') {
      const cfg = ok(await db().from('settings').select('point_rate').eq('key', 'global').maybeSingle());
      pointRate = cfg && Number(cfg.point_rate) > 0 ? Number(cfg.point_rate) : 100;
      pointsToAdd = Math.floor(Number(existing.amount) / pointRate);
      if (!pointsToAdd || pointsToAdd <= 0) return res.status(400).json({ error: `Amount ${existing.amount} KHR is less than ${pointRate} KHR (minimum for 1 point)` });
    }

    // Claim (pending → final) first so a double-click can't credit twice.
    const claimed = ok(await db().from('deposits').update({
      status, ...(status === 'approved' ? { points: pointsToAdd, point_rate_used: pointRate } : {}),
    }).eq('deposit_id', req.params.depositId).eq('status', 'pending').select());
    if (!claimed.length) return res.status(400).json({ error: 'This deposit was already resolved.' });

    let user = null;
    if (status === 'approved') user = await creditPoints(existing.user_email, pointsToAdd);

    res.json({
      success: true, deposit: toDeposit(claimed[0]),
      pointsAdded: pointsToAdd, pointRateUsed: pointRate,
      user: user ? { email: user.email, points: Number(user.points) } : undefined,
    });
  }),
};
