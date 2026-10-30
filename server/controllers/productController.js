const { db, ok, fetchAll } = require('../lib/supabase');
const { toMod, toPurchase } = require('../lib/mappers');
const { ensureUrls } = require('../lib/storage');
const { adjustPoints } = require('./userController');

const LABELS = ['none', 'limited_edition', 'new_arrival', 'out_of_stock'];
const cleanLabel = (v) => (LABELS.includes(v) ? v : undefined);
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s));
const MS_24H = 24 * 60 * 60 * 1000;

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = {
  getAllProducts: wrap(async (req, res) => {
    const rows = ok(await db().from('mods').select('*').order('uploaded_at', { ascending: false }));
    res.json(rows.map((r) => toMod(r)));
  }),

  getProductById: wrap(async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const r = ok(await db().from('mods').select('*').eq('id', req.params.id).maybeSingle());
    if (!r) return res.status(404).json({ error: 'Product not found' });
    res.json(toMod(r));
  }),

  createProduct: wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ error: 'title is required' });
    if (!b.description) return res.status(400).json({ error: 'description is required' });
    const downloadUrl = b.downloadLink || b.downloadUrl || '';
    if (!downloadUrl) return res.status(400).json({ error: 'downloadUrl is required' });

    const cache = new Map();
    const images = await ensureUrls(b.images, 'products', cache);
    const shots = await ensureUrls(b.screenshots, 'products', cache);
    const screenshots = shots.length ? shots : images;
    const row = ok(await db().from('mods').insert({
      title: b.title, description: b.description,
      price_in_points: parseFloat(b.priceInPoints) || 0,
      download_url: downloadUrl, images, screenshots,
      details: Array.isArray(b.details) ? b.details : [],
      owner_name: b.ownerName || 'Admin',
      discount_code: String(b.discountCode || '').toUpperCase(),
      discount_percent: parseFloat(b.discountPercent) || 0,
      version: b.version || '',
      label: cleanLabel(b.label) || 'none',
    }).select().single());
    res.status(201).json({ success: true, product: toMod(row) });
  }),

  deleteProduct: wrap(async (req, res) => {
    const rows = ok(await db().from('mods').delete().eq('id', req.params.id).select('id'));
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  }),

  updateProduct: wrap(async (req, res) => {
    const b = req.body || {};
    const upd = { last_updated_at: new Date().toISOString() };
    if (b.title !== undefined) upd.title = b.title;
    if (b.priceInPoints !== undefined) upd.price_in_points = parseFloat(b.priceInPoints) || 0;
    if (b.description !== undefined) upd.description = b.description;
    if (b.downloadUrl !== undefined) upd.download_url = b.downloadUrl;
    if (b.discountCode !== undefined) upd.discount_code = String(b.discountCode).toUpperCase();
    if (b.discountPercent !== undefined) upd.discount_percent = parseFloat(b.discountPercent) || 0;
    if (b.version !== undefined) upd.version = b.version;
    if (b.label !== undefined && cleanLabel(b.label)) upd.label = b.label;
    const cache = new Map();
    if (Array.isArray(b.images) && b.images.length) {
      upd.images = await ensureUrls(b.images, 'products', cache);
      upd.screenshots = upd.images; // storefront galleries use the same set
    }
    if (Array.isArray(b.screenshots) && b.screenshots.length) upd.screenshots = await ensureUrls(b.screenshots, 'products', cache);

    const rows = ok(await db().from('mods').update(upd).eq('id', req.params.id).select());
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, product: toMod(rows[0]) });
  }),

  // Quick label change from the admin product list
  setLabel: wrap(async (req, res) => {
    const label = cleanLabel(req.body && req.body.label);
    if (!label) return res.status(400).json({ error: `label must be one of: ${LABELS.join(', ')}` });
    const rows = ok(await db().from('mods').update({ label }).eq('id', req.params.id).select());
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, product: toMod(rows[0]) });
  }),

  purchaseProductByEmail: wrap(async (req, res) => {
    const { userEmail } = req.body || {};
    if (!userEmail) return res.status(400).json({ error: 'userEmail is required' });
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Product not found' });

    const mod = ok(await db().from('mods').select('*').eq('id', req.params.id).maybeSingle());
    if (!mod) return res.status(404).json({ error: 'Product not found' });
    if (mod.label === 'out_of_stock') return res.status(409).json({ error: 'This product is out of stock.' });

    const fp = req.body.finalPrice;
    const finalPrice = fp && fp > 0 ? Math.round(fp) : Number(mod.price_in_points);
    if (!finalPrice || finalPrice <= 0) return res.status(400).json({ error: 'Invalid product price' });

    const user = await adjustPoints(userEmail, -finalPrice);
    if (!user) {
      const exists = ok(await db().from('users').select('id').eq('email', userEmail).maybeSingle());
      if (!exists) return res.status(404).json({ error: 'User not found' });
      return res.status(400).json({ error: 'Insufficient points' });
    }
    const purchase = ok(await db().from('purchases').insert({
      user_id: user.id, user_email: user.email, mod_id: mod.id, points_spent: finalPrice,
      notified_update_at: new Date().toISOString(),
    }).select().single());

    res.json({ success: true, downloadUrl: mod.download_url, purchase: toPurchase(purchase),
      user: { email: user.email, points: Number(user.points) } });
  }),

  getPurchasesByEmail: wrap(async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const purchases = ok(await db().from('purchases').select('*').eq('user_email', email).order('purchased_at', { ascending: false }));
    const ids = [...new Set(purchases.map((p) => p.mod_id).filter(Boolean))];
    const mods = ids.length ? ok(await db().from('mods').select('*').in('id', ids)) : [];
    const map = Object.fromEntries(mods.map((m) => [m.id, m]));

    res.json(purchases.filter((p) => map[p.mod_id]).map((p) => {
      const mod = map[p.mod_id];
      const modAt = new Date(mod.last_updated_at || 0).getTime();
      const notifAt = new Date(p.notified_update_at || 0).getTime();
      return {
        purchaseId: p.id, purchasedAt: p.purchased_at, pointsSpent: Number(p.points_spent),
        needsUpdate: modAt > notifAt && Date.now() - modAt < MS_24H,
        downloaded: !!p.downloaded, product: toMod(mod),
      };
    }));
  }),

  acknowledgeUpdate: wrap(async (req, res) => {
    const rows = ok(await db().from('purchases').update({ notified_update_at: new Date().toISOString() }).eq('id', req.params.purchaseId).select());
    if (!rows.length) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ success: true, purchase: toPurchase(rows[0]) });
  }),

  markDownloaded: wrap(async (req, res) => {
    const rows = ok(await db().from('purchases').update({ downloaded: true }).eq('id', req.params.purchaseId).select());
    if (!rows.length) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ success: true, purchase: toPurchase(rows[0]) });
  }),

  getAllOrders: wrap(async (req, res) => {
    const purchases = await fetchAll(() => db().from('purchases').select('*').order('purchased_at', { ascending: false }));
    const ids = [...new Set(purchases.map((p) => p.mod_id).filter(Boolean))];
    const mods = ids.length ? ok(await db().from('mods').select('id,title').in('id', ids)) : [];
    const map = Object.fromEntries(mods.map((m) => [m.id, m.title]));
    res.json(purchases.map((p) => ({
      _id: p.id, userEmail: p.user_email, title: map[p.mod_id] || '(ផលិតផលត្រូវបានលុប)',
      amount: Number(p.points_spent), timestamp: p.purchased_at, status: 'completed',
    })));
  }),

  updateOrder: wrap(async (req, res) => {
    const { pointsSpent, modId } = req.body || {};
    const upd = {};
    if (pointsSpent !== undefined) {
      const v = parseFloat(pointsSpent);
      if (isNaN(v) || v < 0) return res.status(400).json({ error: 'pointsSpent must be a non-negative number' });
      upd.points_spent = v;
    }
    if (modId) {
      const m = ok(await db().from('mods').select('id').eq('id', modId).maybeSingle());
      if (!m) return res.status(404).json({ error: 'Target product not found' });
      upd.mod_id = modId;
    }
    if (!Object.keys(upd).length) return res.status(400).json({ error: 'Nothing to update' });
    const rows = ok(await db().from('purchases').update(upd).eq('id', req.params.id).select());
    if (!rows.length) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ success: true, purchase: toPurchase(rows[0]) });
  }),

  deleteOrder: wrap(async (req, res) => {
    const rows = ok(await db().from('purchases').delete().eq('id', req.params.id).select());
    if (!rows.length) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ success: true, purchase: toPurchase(rows[0]) });
  }),

  clearProductUpdate: wrap(async (req, res) => {
    const rows = ok(await db().from('mods').update({ last_updated_at: new Date(0).toISOString() }).eq('id', req.params.id).select());
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, product: toMod(rows[0]) });
  }),
};
