const crypto = require('crypto');
const axios = require('axios');
const { db, ok } = require('./supabase');

const QR_EXPIRY_MS = 5 * 60 * 1000;

const md5Of = (s) => crypto.createHash('md5').update(s).digest('hex');

function normalizeCode(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const t = String(v).trim();
  if (!t) return null;
  if (/^0+$/.test(t)) return 0;
  const n = Number(t);
  return Number.isNaN(n) ? t : n;
}

function isPaidSignal(r) {
  const data = r && r.data ? r.data : null;
  const code = normalizeCode(r && r.responseCode);
  const msg = r && typeof r.responseMessage === 'string' ? r.responseMessage : '';
  const success = code === 0 || /success/i.test(msg);
  const d = data || {};
  const ids = [d.hash, d.transactionHash, d.txHash, d.paymentHash, d.transactionId, d.transaction_id,
    d.txnId, d.paymentId, d.id, d.reference, d.billNumber,
    d.transaction && d.transaction.hash, d.transaction && d.transaction.id,
    d.payment && d.payment.hash, d.data && d.data.hash];
  const hasId = ids.some((v) => typeof v === 'string' && v.trim());
  const hasData = data && typeof data === 'object' && Object.keys(data).length > 0;
  return !!(success && (hasId || hasData));
}

function isFailureSignal(r, httpStatus) {
  const code = normalizeCode(r && r.responseCode);
  const msg = r && typeof r.responseMessage === 'string' ? r.responseMessage : '';
  if (code === 1 || httpStatus === 404) return false;
  return /declin|reject|fail|invalid|cancel|insufficient/i.test(msg);
}

async function getConfig() {
  let row = ok(await db().from('settings').select('*').eq('key', 'global').maybeSingle());
  if (!row) row = ok(await db().from('settings').insert({ key: 'global' }).select().single());
  return {
    pointRate: Number(row.point_rate) || 100,
    accountId: row.bakong_account_id || process.env.BAKONG_ACCOUNT_ID || '',
    token: row.bakong_token || process.env.BAKONG_TOKEN || '',
    baseUrl: row.bakong_base_url || process.env.BAKONG_BASE_URL || 'https://api-bakong.nbc.gov.kh',
    merchantName: row.bakong_merchant_name || process.env.BAKONG_MERCHANT_NAME || '',
    merchantCity: row.bakong_merchant_city || process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh',
    usdExchangeRate: Number(row.usd_exchange_rate) || 4100,
  };
}

// One call to NBC. Never throws — returns { httpStatus, data, networkError, latencyMs }.
async function nbcCheckMd5(md5, cfg) {
  const started = Date.now();
  try {
    const resp = await axios.post(
      `${cfg.baseUrl.replace(/\/$/, '')}/v1/check_transaction_by_md5`, { md5 },
      { headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, timeout: 9000 }
    );
    return { httpStatus: resp.status, data: resp.data, latencyMs: Date.now() - started };
  } catch (e) {
    return {
      httpStatus: e.response ? e.response.status : null,
      data: e.response ? e.response.data : null,
      networkError: e.response ? null : (e.code || e.message),
      latencyMs: Date.now() - started,
    };
  }
}

// Decode the (unverified) JWT payload of a Bakong token to show its expiry.
function decodeTokenExpiry(token) {
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (!p.exp) return null;
    const expiresAt = new Date(p.exp * 1000);
    return { expiresAt: expiresAt.toISOString(), daysLeft: Math.floor((expiresAt - Date.now()) / 86400000) };
  } catch { return null; }
}

async function creditPoints(email, delta) {
  let rows = ok(await db().rpc('adjust_points', { p_email: email, p_delta: delta }));
  if (!rows || !rows.length) {
    // user doesn't exist yet → create with the points
    const { error } = await db().from('users').insert({ email, username: email.split('@')[0], points: delta, role: 'user' });
    if (error && error.code !== '23505') throw new Error(error.message);
    if (error) rows = ok(await db().rpc('adjust_points', { p_email: email, p_delta: delta }));
    else rows = ok(await db().from('users').select('*').eq('email', email));
  }
  return rows && rows[0];
}

async function claim(depositId, from, to) {
  const rows = ok(await db().from('deposits').update({ status: to })
    .eq('deposit_id', depositId).eq('status', from).select());
  return rows && rows[0];
}

// Verifies one pending Bakong deposit and credits points exactly once.
async function verifyAndCreditDeposit(dep) {
  if (dep.status !== 'pending') return { status: dep.status, points: dep.points };

  if (dep.expires_at && Date.now() > new Date(dep.expires_at).getTime()) {
    await claim(dep.deposit_id, 'pending', 'expired');
    return { status: 'expired' };
  }

  const cfg = await getConfig();
  if (!cfg.token) return { status: 'pending', notice: 'not_configured' };

  const md5 = (dep.md5 || '').trim() || (dep.khqr_string ? md5Of(dep.khqr_string) : '');
  if (!md5) return { status: 'pending' };

  const r = await nbcCheckMd5(md5, cfg);
  const body = r.data;

  if (r.httpStatus === 404 || (body && normalizeCode(body.responseCode) === 1)) return { status: 'pending' };

  if (r.networkError || (r.httpStatus && r.httpStatus >= 400)) {
    if (isFailureSignal(body, r.httpStatus)) {
      await claim(dep.deposit_id, 'pending', 'rejected');
      return { status: 'rejected' };
    }
    console.error(`[bakong.verify] ${dep.deposit_id}: HTTP ${r.httpStatus || 'network'}`, body || r.networkError);
    const n = (dep.check_error_count || 0) + 1;
    await db().from('deposits').update({ check_error_count: n }).eq('deposit_id', dep.deposit_id);
    return { status: 'pending', notice: n >= 3 ? 'verification_delayed' : undefined };
  }

  if (!isPaidSignal(body)) {
    if (isFailureSignal(body, 200)) {
      await claim(dep.deposit_id, 'pending', 'rejected');
      return { status: 'rejected' };
    }
    if (dep.check_error_count) await db().from('deposits').update({ check_error_count: 0 }).eq('deposit_id', dep.deposit_id);
    return { status: 'pending' };
  }

  // Paid. The conditional UPDATE guarantees only one caller wins → points credited once.
  const won = await claim(dep.deposit_id, 'pending', 'approved');
  if (!won) {
    const latest = ok(await db().from('deposits').select('status').eq('deposit_id', dep.deposit_id).maybeSingle());
    return { status: latest && latest.status === 'approved' ? 'approved' : 'pending', points: Number(dep.points) };
  }
  const user = await creditPoints(dep.user_email, Number(dep.points));
  console.log(`[bakong.verify] PAID ${dep.deposit_id}: +${dep.points} → ${dep.user_email}`);
  return { status: 'approved', points: Number(dep.points), userPoints: user ? Number(user.points) : undefined };
}

module.exports = {
  QR_EXPIRY_MS, md5Of, getConfig, nbcCheckMd5, decodeTokenExpiry, isPaidSignal,
  normalizeCode, creditPoints, verifyAndCreditDeposit,
};
