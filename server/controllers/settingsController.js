const { db, ok } = require('../lib/supabase');
const { toSettings } = require('../lib/mappers');
const { uploadBuffer, removeByUrl } = require('../lib/storage');

const MAX_BANNERS = 20;
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

async function loadRow() {
  let row = ok(await db().from('settings').select('*').eq('key', 'global').maybeSingle());
  if (!row) row = ok(await db().from('settings').insert({ key: 'global' }).select().single());
  return row;
}
const saveBanners = async (list) =>
  ok(await db().from('settings').update({ banner_images: list, updated_at: new Date().toISOString() }).eq('key', 'global').select().single());

module.exports = {
  getSettings: wrap(async (req, res) => {
    const { bakongTokenSet, ...safe } = toSettings(await loadRow(), { withToken: false });
    res.json(safe); // never leaks the Bakong token
  }),

  getAdminSettings: wrap(async (req, res) => res.json(toSettings(await loadRow()))),

  updateSettings: wrap(async (req, res) => {
    const b = req.body || {};
    const u = {};
    const str = (k, col) => { if (b[k] !== undefined) u[col] = String(b[k]).trim(); };
    str('siteName', 'site_name'); str('telegramUrl', 'telegram_url'); str('discordUrl', 'discord_url');
    str('bakongAccountId', 'bakong_account_id'); str('bakongToken', 'bakong_token'); str('bakongBaseUrl', 'bakong_base_url');
    str('bakongMerchantName', 'bakong_merchant_name'); str('bakongMerchantCity', 'bakong_merchant_city');
    if (b.pointRate !== undefined) {
      const r = parseFloat(b.pointRate);
      if (isNaN(r) || r < 1) return res.status(400).json({ error: 'pointRate must be a number ≥ 1' });
      u.point_rate = r;
    }
    if (b.usdExchangeRate !== undefined) {
      const r = parseFloat(b.usdExchangeRate);
      if (isNaN(r) || r < 1) return res.status(400).json({ error: 'usdExchangeRate must be a number ≥ 1' });
      u.usd_exchange_rate = r;
    }
    if (b.bannerImages !== undefined) {
      if (!Array.isArray(b.bannerImages)) return res.status(400).json({ error: 'bannerImages must be an array' });
      u.banner_images = b.bannerImages.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
    }
    await loadRow();
    u.updated_at = new Date().toISOString();
    const row = ok(await db().from('settings').update(u).eq('key', 'global').select().single());
    res.json({ success: true, settings: toSettings(row) });
  }),

  getBanners: wrap(async (req, res) => res.json({ bannerImages: (await loadRow()).banner_images || [] })),

  // multipart upload (field "image"); must be < ~4 MB because Vercel limits request bodies to 4.5 MB.
  uploadBanner: wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded (field name must be "image")' });
    const row = await loadRow();
    const list = row.banner_images || [];
    if (list.length >= MAX_BANNERS) return res.status(400).json({ error: `Too many banner images (${MAX_BANNERS} max)` });
    const url = await uploadBuffer(req.file.buffer, req.file.mimetype, 'banners');
    const saved = await saveBanners([...list, url]);
    res.json({ success: true, bannerImages: saved.banner_images, url });
  }),

  replaceBanners: wrap(async (req, res) => {
    const { bannerImages } = req.body || {};
    if (!Array.isArray(bannerImages)) return res.status(400).json({ error: 'bannerImages must be an array of image URLs' });
    if (bannerImages.length > MAX_BANNERS) return res.status(400).json({ error: `Too many banner images — ${MAX_BANNERS} max` });
    const saved = await saveBanners(bannerImages.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()));
    res.json({ success: true, bannerImages: saved.banner_images });
  }),

  deleteBanner: wrap(async (req, res) => {
    const i = parseInt(req.params.index, 10);
    const list = [...((await loadRow()).banner_images || [])];
    if (isNaN(i) || i < 0 || i >= list.length) return res.status(400).json({ error: 'Invalid banner index' });
    const [removed] = list.splice(i, 1);
    const saved = await saveBanners(list);
    removeByUrl(removed);
    res.json({ success: true, bannerImages: saved.banner_images });
  }),
};
