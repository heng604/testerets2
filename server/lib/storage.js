// Vercel's filesystem is read-only, so images go to Supabase Storage.
const crypto = require('crypto');
const { db, BUCKET } = require('./supabase');

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

async function uploadBuffer(buffer, mime, folder) {
  const ext = EXT[mime] || 'jpg';
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 16);
  const path = `${folder}/${Date.now()}-${hash}.${ext}`;
  const { error } = await db().storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: true });
  if (error) throw new Error('Image upload failed: ' + error.message);
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// "data:image/png;base64,...." → public URL. Normal URLs pass through untouched.
async function ensureUrl(value, folder, cache) {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return value;
  if (cache.has(value)) return cache.get(value);
  const m = value.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (!m) return value;
  const url = await uploadBuffer(Buffer.from(m[2], 'base64'), m[1].toLowerCase(), folder);
  cache.set(value, url);
  return url;
}

async function ensureUrls(list, folder, cache = new Map()) {
  if (!Array.isArray(list)) return [];
  return Promise.all(list.map((v) => ensureUrl(v, folder, cache)));
}

// Remove a stored object given its public URL (best effort).
async function removeByUrl(url) {
  try {
    const marker = `/object/public/${BUCKET}/`;
    const i = String(url).indexOf(marker);
    if (i === -1) return;
    await db().storage.from(BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))]);
  } catch { /* ignore */ }
}

module.exports = { uploadBuffer, ensureUrl, ensureUrls, removeByUrl };
