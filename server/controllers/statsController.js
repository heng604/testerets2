const { db, ok, fetchAll } = require('../lib/supabase');

const DAY = 86400000;
const pct = (c, p) => (!p ? (c > 0 ? 100 : 0) : Math.round(((c - p) / p) * 1000) / 10);
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

function rates(purchases, totalUsers) {
  const by = {};
  purchases.forEach((p) => { by[p.user_email] = (by[p.user_email] || 0) + 1; });
  const buyers = Object.keys(by);
  const rep = buyers.filter((e) => by[e] > 1).length;
  return { repeat: buyers.length ? (rep / buyers.length) * 100 : 0, conv: totalUsers ? (buyers.length / totalUsers) * 100 : 0 };
}

module.exports = {
  getDashboardStats: async (req, res) => {
    try {
      const now = Date.now();
      const days = req.query.days === 'all' ? null : (parseInt(req.query.days, 10) || 7);
      const start = days ? now - days * DAY : 0;
      const prevStart = days ? now - 2 * days * DAY : 0;
      const chartStart = now - 7 * DAY;
      const inRange = (t, a, b) => { const x = new Date(t).getTime(); return x >= a && (b === undefined || x < b); };

      const settings = ok(await db().from('settings').select('point_rate').eq('key', 'global').maybeSingle());
      const pointRate = settings ? Number(settings.point_rate) : 100;

      const [users, purchases, deposits] = await Promise.all([
        fetchAll(() => db().from('users').select('email,username,avatar,created_at')),
        fetchAll(() => db().from('purchases').select('id,user_email,mod_id,points_spent,purchased_at').order('purchased_at', { ascending: false })),
        fetchAll(() => db().from('deposits').select('amount,timestamp').eq('status', 'approved')),
      ]);
      const totalUsers = users.length;

      const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
      const revCur = sum(deposits.filter((d) => inRange(d.timestamp, start)), (d) => Number(d.amount));
      const revPrev = sum(deposits.filter((d) => inRange(d.timestamp, prevStart, start)), (d) => Number(d.amount));
      const newCur = users.filter((u) => inRange(u.created_at, start)).length;
      const newPrev = users.filter((u) => inRange(u.created_at, prevStart, start)).length;

      const pCur = purchases.filter((p) => inRange(p.purchased_at, start));
      const pPrev = purchases.filter((p) => inRange(p.purchased_at, prevStart, start));
      const rc = rates(pCur, totalUsers), rp = rates(pPrev, totalUsers);
      const aovCur = pCur.length ? sum(pCur, (p) => Number(p.points_spent)) / pCur.length : 0;
      const aovPrev = pPrev.length ? sum(pPrev, (p) => Number(p.points_spent)) / pPrev.length : 0;

      const ordersMap = {}, revMap = {};
      purchases.filter((p) => inRange(p.purchased_at, chartStart)).forEach((p) => { const k = dayKey(p.purchased_at); ordersMap[k] = (ordersMap[k] || 0) + 1; });
      deposits.filter((d) => inRange(d.timestamp, chartStart)).forEach((d) => { const k = dayKey(d.timestamp); revMap[k] = (revMap[k] || 0) + Number(d.amount); });
      const summary = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * DAY); const k = dayKey(d);
        summary.push({ date: k, label: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }), orders: ordersMap[k] || 0, revenue: revMap[k] || 0 });
      }

      const salesBy = {};
      purchases.forEach((p) => { if (p.mod_id) salesBy[p.mod_id] = (salesBy[p.mod_id] || 0) + 1; });
      const top = Object.entries(salesBy).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const recent = purchases.slice(0, 6);
      const modIds = [...new Set([...top.map((t) => t[0]), ...recent.map((p) => p.mod_id).filter(Boolean)])];
      const mods = modIds.length ? ok(await db().from('mods').select('id,title,images,screenshots,price_in_points').in('id', modIds)) : [];
      const mm = Object.fromEntries(mods.map((m) => [m.id, m]));

      const mostSellingProducts = top.filter(([id]) => mm[id]).map(([id, sales]) => ({
        id, title: mm[id].title, image: (mm[id].images || [])[0] || (mm[id].screenshots || [])[0] || null,
        sales, priceInPoints: Number(mm[id].price_in_points),
      }));
      const recentOrders = recent.map((p) => ({
        orderId: `#${String(p.id).replace(/-/g, '').slice(-6).toUpperCase()}`, customer: p.user_email,
        product: (mm[p.mod_id] && mm[p.mod_id].title) || '(product deleted)', pointsSpent: Number(p.points_spent), date: p.purchased_at, status: 'Completed',
      }));

      const wk = {};
      purchases.filter((p) => inRange(p.purchased_at, chartStart)).forEach((p) => { wk[p.user_email] = (wk[p.user_email] || 0) + 1; });
      const um = Object.fromEntries(users.map((u) => [u.email, u]));
      const weeklyTopCustomers = Object.entries(wk).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([email, orders]) => ({
        email, username: (um[email] && um[email].username) || email.split('@')[0], avatar: (um[email] && um[email].avatar) || null, orders,
      }));

      const has = !!days;
      res.json({
        pointRate, totalUsers, periodDays: days,
        revenue: { total: revCur, deltaPct: has ? pct(revCur, revPrev) : 0 },
        newCustomers: { total: newCur, deltaPct: has ? pct(newCur, newPrev) : 0 },
        repeatPurchaseRate: { pct: Math.round(rc.repeat * 10) / 10, deltaPct: has ? pct(rc.repeat, rp.repeat) : 0 },
        avgOrderValue: { points: Math.round(aovCur * 10) / 10, currency: Math.round(aovCur * pointRate), deltaPct: has ? pct(aovCur, aovPrev) : 0, ordersInPeriod: pCur.length },
        conversionRate: { pct: Math.round(rc.conv * 100) / 100, deltaPct: has ? pct(rc.conv, rp.conv) : 0 },
        summary, mostSellingProducts, recentOrders, weeklyTopCustomers,
      });
    } catch (e) {
      console.error('getDashboardStats error:', e);
      res.status(500).json({ error: e.message });
    }
  },
};
