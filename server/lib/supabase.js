// Lazy Supabase client — created on first use so a missing env var produces a
// readable JSON error instead of crashing the whole Vercel function at import.
const { createClient } = require('@supabase/supabase-js');

let client = null;

function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

// Throws on a Supabase error, returns data otherwise.
function ok({ data, error }) {
  if (error) {
    const e = new Error(error.message || 'Database error');
    e.code = error.code;
    throw e;
  }
  return data;
}

// Supabase returns max 1000 rows per request — page through everything.
async function fetchAll(buildQuery, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const data = ok(await buildQuery().range(from, from + pageSize - 1));
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'store-images';

module.exports = { db, ok, fetchAll, BUCKET };
