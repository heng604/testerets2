// Server-verified auth. The old app trusted whatever email the browser sent,
// which meant anyone could call the admin API. Now:
//   • POST /api/auth/google verifies the Google access token with Google,
//     then returns a signed JWT (role comes from the database).
//   • requireAdmin checks that JWT on every admin-only route.
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { db, ok } = require('./supabase');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'seangheng2006@gmail.com').toLowerCase();

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET is missing or too short (min 16 chars) — set it in the environment.');
  return s;
}

const signToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email, role: user.role }, secret(), { expiresIn: '7d' });

function readBearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// Verify a Google OAuth access token → { email, name, picture }
async function verifyGoogleAccessToken(accessToken) {
  const { data } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { access_token: accessToken }, timeout: 8000,
  });
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (expectedAud && data.aud !== expectedAud && data.azp !== expectedAud) {
    throw new Error('Google token was not issued for this app');
  }
  if (!data.email || String(data.email_verified) !== 'true') throw new Error('Google email not verified');
  let name = '', picture = '';
  try {
    const info = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }, timeout: 8000,
    });
    name = info.data.name || ''; picture = info.data.picture || '';
  } catch { /* optional */ }
  return { email: String(data.email).toLowerCase(), name, picture };
}

async function adminFromRequest(req) {
  const token = readBearer(req);
  if (!token) return null;
  let decoded;
  try { decoded = jwt.verify(token, secret()); } catch { return null; }
  if (decoded.role !== 'admin') return null;
  // Re-check the DB so a demoted/deleted admin loses access immediately.
  const user = ok(await db().from('users').select('id,email,role').eq('email', decoded.email).maybeSingle());
  if (!user || user.role !== 'admin') return null;
  return user;
}

async function requireAdmin(req, res, next) {
  try {
    const admin = await adminFromRequest(req);
    if (!admin) return res.status(401).json({ error: 'Admin login required' });
    req.admin = admin;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Sets req.isAdmin without rejecting (used to decide what a response may include).
async function optionalAdmin(req, res, next) {
  try { req.isAdmin = !!(await adminFromRequest(req)); } catch { req.isAdmin = false; }
  next();
}

module.exports = { ADMIN_EMAIL, signToken, verifyGoogleAccessToken, requireAdmin, optionalAdmin };
