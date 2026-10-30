// Admin-only "Is Bakong working?" tools (Dashboard → Bakong Tester).
// Nothing here ever credits points or touches real customer deposits.
const { db, ok } = require('../lib/supabase');
const { getConfig, nbcCheckMd5, decodeTokenExpiry, isPaidSignal, normalizeCode } = require('../lib/bakong');
const { buildKhqr } = require('./bakongController');

const DUMMY_MD5 = '00000000000000000000000000000000';

async function log(row) {
  try { return ok(await db().from('bakong_tests').insert(row).select().single()); } catch { return null; }
}

module.exports = {
  // POST /api/admin/bakong/diagnose — checks config, token and reachability to NBC.
  diagnose: async (req, res) => {
    try {
      const cfg = await getConfig();
      const checks = [];
      const add = (id, label, status, detail) => checks.push({ id, label, status, detail });

      add('account', 'Bakong account ID', cfg.accountId ? 'pass' : 'fail',
        cfg.accountId || 'Missing — set it in Settings (e.g. name@bkrt)');
      add('merchant', 'Merchant name', cfg.merchantName ? 'pass' : 'fail',
        cfg.merchantName || 'Missing — customers cannot generate QR codes without it');

      const exp = cfg.token ? decodeTokenExpiry(cfg.token) : null;
      if (!cfg.token) add('token', 'API token', 'fail', 'Missing — auto-confirm of payments cannot work');
      else if (exp && exp.daysLeft < 0) add('token', 'API token', 'fail', `Expired ${-exp.daysLeft} day(s) ago (${exp.expiresAt.slice(0, 10)})`);
      else if (exp && exp.daysLeft < 14) add('token', 'API token', 'warn', `Expires in ${exp.daysLeft} day(s) (${exp.expiresAt.slice(0, 10)})`);
      else add('token', 'API token', 'pass', exp ? `Valid, expires ${exp.expiresAt.slice(0, 10)} (${exp.daysLeft} days left)` : 'Present (expiry not readable)');

      let ping = null;
      if (cfg.token) {
        ping = await nbcCheckMd5(DUMMY_MD5, cfg);
        const code = ping.data && normalizeCode(ping.data.responseCode);
        if (ping.networkError) add('nbc', 'Reach Bakong API', 'fail', `Network error: ${ping.networkError}`);
        else if (ping.httpStatus === 401) add('nbc', 'Reach Bakong API', 'fail', 'HTTP 401 — token is invalid or expired. Renew it at api-bakong.nbc.gov.kh and paste it in Settings.');
        else if (ping.httpStatus === 403 || ping.httpStatus === 451) add('nbc', 'Reach Bakong API', 'fail', `HTTP ${ping.httpStatus} — NBC blocked this server. NBC only allows check_transaction_by_md5 from servers in Cambodia; Vercel is outside Cambodia (see README → "Bakong on Vercel").`);
        else if (ping.httpStatus === 404 || code === 1) add('nbc', 'Reach Bakong API', 'pass', `Token accepted, API answered in ${ping.latencyMs} ms ("transaction not found" is the expected reply for this probe)`);
        else if (ping.httpStatus >= 200 && ping.httpStatus < 300) add('nbc', 'Reach Bakong API', 'pass', `API answered in ${ping.latencyMs} ms`);
        else add('nbc', 'Reach Bakong API', 'warn', `Unexpected reply HTTP ${ping.httpStatus}: ${JSON.stringify(ping.data).slice(0, 200)}`);
      } else add('nbc', 'Reach Bakong API', 'skip', 'Skipped — no token');

      let qrOk = false;
      if (cfg.accountId && cfg.merchantName) {
        try { await buildKhqr({ cfg, amount: 100, currency: 'KHR', billNumber: 'DIAG-TEST' }); qrOk = true; add('qr', 'Generate KHQR', 'pass', 'KHQR string generated successfully'); }
        catch (e) { add('qr', 'Generate KHQR', 'fail', e.message); }
      } else add('qr', 'Generate KHQR', 'skip', 'Skipped — account/merchant missing');

      const overall = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
      await log({ kind: 'ping', status: overall === 'fail' ? 'error' : 'ok', http_status: ping ? ping.httpStatus : null,
        message: checks.filter((c) => c.status !== 'pass').map((c) => `${c.label}: ${c.detail}`).join(' | ') || 'All checks passed',
        raw_response: ping ? ping.data : null, created_by: req.admin.email });

      res.json({
        overall, checks, qrOk,
        server: { region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'local', baseUrl: cfg.baseUrl },
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  // POST /api/admin/bakong/test-qr  { amount, currency }  → a real, payable test QR (not linked to any user)
  createTestQR: async (req, res) => {
    try {
      const currency = String((req.body && req.body.currency) || 'KHR').toUpperCase();
      let amount = Number(req.body && req.body.amount);
      if (!['KHR', 'USD'].includes(currency)) return res.status(400).json({ error: "currency must be 'KHR' or 'USD'" });
      if (!amount || amount <= 0) amount = currency === 'USD' ? 0.01 : 100;
      if (currency === 'KHR') amount = Math.round(amount);
      if ((currency === 'KHR' && amount > 40000) || (currency === 'USD' && amount > 10)) {
        return res.status(400).json({ error: 'Test amount too large — use a small amount (≤ 40,000 KHR or ≤ 10 USD).' });
      }
      const cfg = await getConfig();
      if (!cfg.accountId || !cfg.merchantName) return res.status(400).json({ error: 'Set Bakong account ID and merchant name in Settings first.' });

      const k = await buildKhqr({ cfg, amount, currency, billNumber: `TEST-${Date.now()}` });
      const row = await log({
        kind: 'qr', amount, currency, md5: k.md5, khqr_string: k.qr, status: 'pending',
        message: 'Test QR created', created_by: req.admin.email, expires_at: new Date(k.expirationTimestamp).toISOString(),
      });
      res.status(201).json({ testId: row && row.id, qrImage: k.qrImage, amount, currency, md5: k.md5, expiresAt: k.expirationTimestamp });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  // GET /api/admin/bakong/test-qr/:id/check — asks NBC whether the test QR was paid
  checkTestQR: async (req, res) => {
    try {
      const t = ok(await db().from('bakong_tests').select('*').eq('id', req.params.id).eq('kind', 'qr').maybeSingle());
      if (!t) return res.status(404).json({ error: 'Test not found' });
      if (t.status === 'paid') return res.json({ status: 'paid', message: t.message });

      const cfg = await getConfig();
      if (!cfg.token) return res.json({ status: 'error', message: 'No Bakong token configured.' });
      const r = await nbcCheckMd5(t.md5, cfg);
      const code = r.data && normalizeCode(r.data.responseCode);

      let status = 'pending', message = 'Not paid yet — scan the QR with a banking app and pay, then check again.';
      if (r.networkError) { status = 'error'; message = `Network error: ${r.networkError}`; }
      else if (r.httpStatus === 401) { status = 'error'; message = 'HTTP 401 — token invalid or expired.'; }
      else if (r.httpStatus === 403 || r.httpStatus === 451) { status = 'error'; message = `HTTP ${r.httpStatus} — NBC blocked this server (needs a Cambodia IP).`; }
      else if (r.httpStatus === 404 || code === 1) { /* pending */ }
      else if (isPaidSignal(r.data)) { status = 'paid'; message = '✅ Payment detected — Bakong verification works end-to-end.'; }
      else if (r.httpStatus >= 400) { status = 'error'; message = `HTTP ${r.httpStatus}: ${JSON.stringify(r.data).slice(0, 200)}`; }

      if (status !== 'pending' || (t.expires_at && Date.now() > new Date(t.expires_at).getTime())) {
        await db().from('bakong_tests').update({
          status: status === 'pending' ? 'expired' : status, http_status: r.httpStatus, message, raw_response: r.data,
        }).eq('id', t.id);
      }
      const expired = status === 'pending' && t.expires_at && Date.now() > new Date(t.expires_at).getTime();
      res.json({ status: expired ? 'expired' : status, message: expired ? 'QR expired without payment.' : message, httpStatus: r.httpStatus, latencyMs: r.latencyMs, raw: r.data });
    } catch (e) { res.status(500).json({ error: e.message }); }
  },

  history: async (req, res) => {
    try {
      const rows = ok(await db().from('bakong_tests')
        .select('id,kind,amount,currency,status,http_status,message,created_by,created_at').order('created_at', { ascending: false }).limit(15));
      res.json(rows.map((r) => ({
        id: r.id, kind: r.kind, amount: r.amount === null ? null : Number(r.amount), currency: r.currency, status: r.status,
        httpStatus: r.http_status, message: r.message, createdBy: r.created_by, createdAt: r.created_at,
      })));
    } catch (e) { res.status(500).json({ error: e.message }); }
  },
};
