const QRCode = require('qrcode');
const { BakongKHQR, khqrData, IndividualInfo } = require('bakong-khqr');
const { db, ok } = require('../lib/supabase');
const { QR_EXPIRY_MS, md5Of, getConfig, verifyAndCreditDeposit } = require('../lib/bakong');

// Generates a KHQR (used by both customers and the admin tester).
async function buildKhqr({ cfg, amount, currency, billNumber }) {
  const expirationTimestamp = Date.now() + QR_EXPIRY_MS;
  const info = new IndividualInfo(cfg.accountId, cfg.merchantName, cfg.merchantCity, {
    currency: currency === 'USD' ? khqrData.currency.usd : khqrData.currency.khr,
    amount, billNumber, expirationTimestamp,
  });
  const response = new BakongKHQR().generateIndividual(info);
  if (!response || !response.data || (response.status && response.status.code !== 0)) {
    const msg = response && response.status && response.status.message;
    throw new Error('KHQR generation failed' + (msg ? `: ${msg}` : ''));
  }
  const { qr, md5 } = response.data;
  return {
    qr, expirationTimestamp,
    md5: (typeof md5 === 'string' && md5.trim()) ? md5.trim() : md5Of(qr),
    qrImage: await QRCode.toDataURL(qr, { margin: 1, width: 400 }),
  };
}

module.exports = {
  buildKhqr,

  generateQR: async (req, res) => {
    try {
      const { userEmail, points, currency } = req.body || {};
      const curr = (currency || 'KHR').toUpperCase();
      if (!userEmail) return res.status(400).json({ error: 'userEmail is required' });
      const pts = parseInt(points, 10);
      if (!pts || pts <= 0) return res.status(400).json({ error: 'points must be a positive whole number' });
      if (!['KHR', 'USD'].includes(curr)) return res.status(400).json({ error: "currency must be 'KHR' or 'USD'" });

      const cfg = await getConfig();
      if (!cfg.accountId || !cfg.merchantName) {
        return res.status(503).json({ error: 'Bakong top-up is not configured yet. Please contact the admin.' });
      }

      const amountKhr = pts * cfg.pointRate;
      let amount = amountKhr;
      if (curr === 'USD') {
        amount = Math.round((amountKhr / cfg.usdExchangeRate) * 100) / 100;
        if (amount < 0.01) return res.status(400).json({ error: 'Amount too small for USD QR' });
      }

      const depositId = `BKG-${Math.floor(1000 + Math.random() * 9000)}-${Date.now()}`;
      const k = await buildKhqr({ cfg, amount, currency: curr, billNumber: depositId });

      ok(await db().from('deposits').insert({
        deposit_id: depositId, user_email: userEmail, method: 'Bakong KHQR', amount, currency: curr,
        points: pts, point_rate_used: cfg.pointRate, khqr_string: k.qr, md5: k.md5,
        source: 'bakong', status: 'pending', expires_at: new Date(k.expirationTimestamp).toISOString(),
      }));

      res.status(201).json({ depositId, qrImage: k.qrImage, amount, currency: curr, points: pts, expiresAt: k.expirationTimestamp });
    } catch (e) {
      console.error('generateQR error:', e);
      res.status(500).json({ error: e.message });
    }
  },

  checkStatus: async (req, res) => {
    try {
      const dep = ok(await db().from('deposits').select('*')
        .eq('deposit_id', req.params.depositId).eq('source', 'bakong').maybeSingle());
      if (!dep) return res.status(404).json({ error: 'Deposit not found' });
      res.json(await verifyAndCreditDeposit(dep));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  // GET /api/cron/bakong-poll — verifies every pending QR (replaces the old setInterval poller,
  // which cannot run on Vercel). Protected by CRON_SECRET. Optional, see README.
  cronPoll: async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const pending = ok(await db().from('deposits').select('*').eq('source', 'bakong').eq('status', 'pending'));
      const results = [];
      for (const d of pending) results.push({ id: d.deposit_id, ...(await verifyAndCreditDeposit(d)) });
      res.json({ checked: pending.length, results });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },
};
