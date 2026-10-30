import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchPendingDeposits, deleteProduct, verifyDeposit, fetchSettings } from '../services/api';
import { formatDateTime } from '../utils/dateUtils';
import BakongTester from './BakongTester';
import Icon from '../components/Icon';

const API = '';

// ── Dark theme tokens (matches the rest of the admin panel / site) ───────────
const LT = {
  bg:        '#07060d',
  card:      '#100d1c',
  border:    '#241f3a',
  borderSoft:'#1c1c2a',
  text:      '#ffffff',
  textSub:   '#c7cad1',
  textMuted: '#94a3b8',
  textFaint: '#6b7280',
  accent:    '#7c5cff',
};

const STAT_META = {
  revenue:    { label: 'Ecommerce Revenue',    bg: 'rgba(124,92,255,0.14)',  accent: '#a78bfa', icon: '💰' },
  customers:  { label: 'New Customers',        bg: 'rgba(16,185,129,0.14)', accent: '#10b981', icon: '🧑‍🤝‍🧑' },
  repeat:     { label: 'Repeat Purchase Rate', bg: 'rgba(124,92,255,0.16)',  accent: '#fbbf24', icon: '🔁' },
  aov:        { label: 'Average Order Value',  bg: 'rgba(20,184,166,0.14)', accent: '#2dd4bf', icon: '🧾' },
  conversion: { label: 'Conversion Rate',      bg: 'rgba(244,63,94,0.14)',  accent: '#fb7185', icon: '📈' },
};

function fmtKHR(n) {
  return `${Math.round(n || 0).toLocaleString()} ៛`;
}
function fmtNum(n) {
  return Math.round(n || 0).toLocaleString();
}
function initials(str) {
  return (str || '?').trim().slice(0, 1).toUpperCase();
}
function displayName(email) {
  if (!email) return 'Unknown';
  const local = email.split('@')[0];
  return local.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function Delta({ pct }) {
  const up = pct >= 0;
  const col = up ? '#22c55e' : '#fb7185';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: col, background: up ? 'rgba(34,197,94,0.14)' : 'rgba(251,113,133,0.14)', padding: '3px 9px', borderRadius: 20 }}>
      <span style={{ fontSize: 10 }}>{up ? '▲' : '▼'}</span> {Math.abs(pct)}%
    </span>
  );
}

// ── Reusable card shell ───────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{ background: LT.card, border: `1px solid ${LT.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: '0 4px 16px rgba(0,0,0,0.35)', ...style }}>
      {children}
    </div>
  );
}

// ── Summary trend chart (orders + revenue, trailing 7 days) ────────────────
function SummaryChart({ summary }) {
  if (!summary || summary.length === 0) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: LT.textFaint, fontSize: 13 }}>No activity in the last 7 days yet.</div>;
  }

  const w = summary.length * 90;
  const h = 160;
  const padTop = 22, padBottom = 24;

  const revenues = summary.map(s => s.revenue);
  const orders   = summary.map(s => s.orders);
  const rMax = Math.max(...revenues, 1), rMin = Math.min(...revenues, 0);
  const oMax = Math.max(...orders, 1),   oMin = Math.min(...orders, 0);

  const xFor = i => (i / (summary.length - 1 || 1)) * (w - 40) + 20;
  const yForRevenue = v => padTop + (1 - (v - rMin) / ((rMax - rMin) || 1)) * (h - padTop - padBottom);
  const yForOrders   = v => padTop + (1 - (v - oMin) / ((oMax - oMin) || 1)) * (h - padTop - padBottom);

  const revenuePts = summary.map((s, i) => `${xFor(i)},${yForRevenue(s.revenue)}`).join(' ');
  const ordersPts  = summary.map((s, i) => `${xFor(i)},${yForOrders(s.orders)}`).join(' ');

  const peakIdx = revenues.indexOf(rMax);

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg width="100%" height={h + 24} viewBox={`0 0 ${w} ${h + 24}`} preserveAspectRatio="none" style={{ display: 'block', minWidth: 480 }}>
        <polyline points={ordersPts} fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        <polyline points={revenuePts} fill="none" stroke="#22c55e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {summary.map((s, i) => (
          <circle key={i} cx={xFor(i)} cy={yForRevenue(s.revenue)} r={i === peakIdx ? 4.5 : 3} fill={i === peakIdx ? '#22c55e' : '#100d1c'} stroke="#22c55e" strokeWidth="2" />
        ))}
        {summary.map((s, i) => (
          <text key={i} x={xFor(i)} y={h + 16} textAnchor="middle" fontSize="10.5" fill={LT.textFaint}>{s.label}</text>
        ))}
      </svg>
      {rMax > 0 && (
        <div style={{
          position: 'absolute',
          left: `calc(${(xFor(peakIdx) / w) * 100}% - 34px)`,
          top: `${(yForRevenue(rMax) / (h + 24)) * 100 - 12}%`,
          background: '#22c55e', color: '#04140a', fontSize: 11, fontWeight: 700,
          padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {fmtKHR(rMax)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
export default function Dashboard({ products, setProducts, pendingDeposits, setPendingDeposits, setUserPoints, setTransactions, loggedInEmail }) {
  const [selectedSlipUrl, setSelectedSlipUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats]                 = useState(null);
  const [statsLoading, setStatsLoading]   = useState(true);
  const [period, setPeriod]               = useState('7');
  const [pointRate, setPointRate]         = useState(100);

  // Keep the exchange rate live — if the admin edits it in Settings while this
  // tab is open, the "→ X pts" preview here should follow, not stay stale.
  useEffect(() => {
    const loadPointRate = () => {
      fetchSettings()
        .then(data => { if (data && data.pointRate > 0) setPointRate(data.pointRate); })
        .catch(() => {});
    };
    loadPointRate();
    const interval = setInterval(loadPointRate, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = useCallback(() => {
    fetch(`${API}/api/stats/dashboard?days=${period}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [period]);

  const loadPendingDeposits = () => {
    fetchPendingDeposits()
      .then(deposits => {
        const mapped = deposits.map(d => ({
          id: d.depositId,
          user: d.userEmail,
          method: d.method,
          amount: d.amount,
          slipUrl: d.slipUrl,
          timestamp: d.timestamp,
          status: d.status,
        }));
        setPendingDeposits(mapped);
      })
      .catch(err => console.warn('Could not fetch pending deposits:', err));
  };

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadPendingDeposits();
    const interval = setInterval(() => { loadPendingDeposits(); loadStats(); }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      const res = await deleteProduct(id);
      if (!res.ok) throw new Error('Delete failed');
      setProducts(products.filter(p => p._id !== id));
    } catch (err) {
      alert('Delete failed — please try again.');
    }
  };

  const handleVerifyDeposit = async (depositId, action) => {
    const transaction = pendingDeposits.find(d => d.id === depositId);
    if (!transaction) return;
    try {
      const res = await verifyDeposit(depositId, action);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Verify failed'); }
      const result = await res.json();
      if (action === 'approve') {
        // Use the points the SERVER actually credited — it always reads the
        // admin's current exchange rate at the moment of approval, so this
        // stays correct even if the rate was changed after the user paid.
        const addedPoints = result.pointsAdded;
        if (result.user && typeof result.user.points === 'number') {
          if (loggedInEmail && transaction.user === loggedInEmail) setUserPoints(result.user.points);
          alert(`Approved! Added ${addedPoints} pts to ${transaction.user}. New balance: ${result.user.points}`);
        } else {
          alert(`Approved! Added ${addedPoints} pts to ${transaction.user}`);
        }
        setTransactions(prev => prev.map(tx => tx.id === depositId
          ? { ...tx, status: 'approved', points: addedPoints, pointRateUsed: result.pointRateUsed }
          : tx));
      } else {
        alert('Deposit rejected.');
        setTransactions(prev => prev.map(tx => tx.id === depositId ? { ...tx, status: 'rejected' } : tx));
      }
      setPendingDeposits(prev => prev.filter(d => d.id !== depositId));
      loadStats();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const adminName = displayName(loggedInEmail);

  // ── Shared dark-theme styles ─────────────────────────────────────────
  const th = { padding: '12px 16px', color: LT.textFaint, fontSize: 12, fontWeight: 700, textAlign: 'left', borderBottom: `1px solid ${LT.border}`, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em' };
  const td = { padding: '13px 16px', fontSize: 13.5, color: LT.textSub, borderBottom: `1px solid ${LT.borderSoft}` };
  const secTitle = { fontSize: 15.5, fontWeight: 800, color: LT.text };
  const tabBtn = (active) => ({ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: active ? LT.accent : 'transparent', color: active ? '#fff' : LT.textMuted });

  return (
    <div style={{ background: LT.bg, minHeight: '100vh', padding: '28px 32px 60px', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={tabBtn(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>Overview</button>
        <button style={tabBtn(activeTab === 'deposits')} onClick={() => setActiveTab('deposits')}>
          Pending Deposits
          {pendingDeposits.length > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, marginLeft: 6 }}>{pendingDeposits.length}</span>
          )}
        </button>
        <button style={tabBtn(activeTab === 'products')} onClick={() => setActiveTab('products')}>Products</button>
        <button style={tabBtn(activeTab === 'bakong')} onClick={() => setActiveTab('bakong')}><Icon name="flask" size={14} /> Bakong Tester</button>
      </div>

      {/* ══════════════════════════════ OVERVIEW ══════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 26 }}>
            <div>
              <h1 style={{ fontSize: 25, fontWeight: 800, color: LT.text, margin: 0 }}>Welcome Back, {adminName}!</h1>
              <div style={{ fontSize: 13.5, color: LT.textMuted, marginTop: 5 }}>Here's what's happening with your store today</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                style={{ background: LT.card, border: `1px solid ${LT.border}`, color: LT.textSub, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
              <button
                onClick={() => setPeriod('all')}
                style={{ background: period === 'all' ? LT.accent : LT.card, color: period === 'all' ? '#fff' : LT.text, border: `1px solid ${period === 'all' ? LT.accent : LT.border}`, padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                View All Time
              </button>
            </div>
          </div>

          {/* 5 stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
            {(() => {
              const s = stats;
              const cards = [
                { key: 'revenue',    value: s ? fmtKHR(s.revenue.total) : '…',            delta: s?.revenue.deltaPct,        sub: 'vs previous period' },
                { key: 'customers',  value: s ? fmtNum(s.newCustomers.total) : '…',        delta: s?.newCustomers.deltaPct,   sub: 'vs previous period' },
                { key: 'repeat',     value: s ? `${s.repeatPurchaseRate.pct}%` : '…',      delta: s?.repeatPurchaseRate.deltaPct, sub: 'of buyers repeat' },
                { key: 'aov',        value: s ? fmtKHR(s.avgOrderValue.currency) : '…',    delta: s?.avgOrderValue.deltaPct,  sub: `${s?.avgOrderValue.ordersInPeriod ?? 0} orders` },
                { key: 'conversion', value: s ? `${s.conversionRate.pct}%` : '…',          delta: s?.conversionRate.deltaPct, sub: 'users who purchased' },
              ];
              return cards.map(c => {
                const meta = STAT_META[c.key];
                return (
                  <div key={c.key} style={{ background: meta.bg, border: `1px solid ${LT.border}`, borderRadius: 16, padding: '18px 18px 16px' }}>
                    <div style={{ fontSize: 12.5, color: meta.accent, fontWeight: 600, marginBottom: 10 }}>{meta.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: LT.text, marginBottom: 10, letterSpacing: '-0.3px' }}>{statsLoading ? '…' : c.value}</div>
                    {stats && <Delta pct={c.delta ?? 0} />}
                    <div style={{ fontSize: 10.5, color: LT.textMuted, marginTop: 6 }}>{c.sub}</div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Summary chart + Most Selling Products */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={secTitle}>Summary</div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: LT.textMuted }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Revenue
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: LT.textMuted }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} /> Orders
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: LT.textFaint, marginBottom: 10 }}>Last 7 days</div>
              <SummaryChart summary={stats?.summary} />
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={secTitle}>Most Selling Products</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(stats?.mostSellingProducts || []).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: LT.borderSoft, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 18 }}>📦</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: LT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: LT.textFaint }}>ID: {String(p.id).slice(-6).toUpperCase()}</div>
                    </div>
                    <div style={{ background: 'rgba(124,92,255,0.14)', color: '#fbbf24', fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      {p.sales} Sale{p.sales === 1 ? '' : 's'}
                    </div>
                  </div>
                ))}
                {stats && stats.mostSellingProducts.length === 0 && (
                  <div style={{ color: LT.textFaint, fontSize: 12.5, textAlign: 'center', padding: '20px 0' }}>No sales yet.</div>
                )}
              </div>
            </Card>
          </div>

          {/* Recent Orders + Weekly Top Customers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px 14px' }}>
                <div style={secTitle}>Recent Orders</div>
                <Link to="/admin-orders" style={{ background: 'rgba(124,92,255,0.14)', color: '#fbbf24', border: '1px solid #7c5cff', padding: '7px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>View All</Link>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Product</th>
                    <th style={th}>Customer</th>
                    <th style={th}>Order ID</th>
                    <th style={th}>Date</th>
                    <th style={{ ...th, textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.recentOrders || []).map(o => (
                    <tr key={o.orderId}>
                      <td style={{ ...td, color: LT.text, fontWeight: 600 }}>{o.product}</td>
                      <td style={{ ...td, color: '#fbbf24', fontWeight: 600 }}>{displayName(o.customer)}</td>
                      <td style={{ ...td, color: LT.textFaint }}>{o.orderId}</td>
                      <td style={{ ...td, color: LT.textFaint }}>{new Date(o.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#22c55e', fontWeight: 700, fontSize: 12 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stats && stats.recentOrders.length === 0 && (
                <div style={{ color: LT.textFaint, textAlign: 'center', padding: 32, fontSize: 13 }}>No orders yet.</div>
              )}
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={secTitle}>Weekly Top Customers</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(stats?.weeklyTopCustomers || []).map(c => (
                  <div key={c.email} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#7c5cff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                      {c.avatar ? <img src={c.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(c.username)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: LT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(c.email)}</div>
                      <div style={{ fontSize: 11.5, color: LT.textFaint }}>{c.orders} Order{c.orders === 1 ? '' : 's'}</div>
                    </div>
                    <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View</span>
                  </div>
                ))}
                {stats && stats.weeklyTopCustomers.length === 0 && (
                  <div style={{ color: LT.textFaint, fontSize: 12.5, textAlign: 'center', padding: '20px 0' }}>No orders in the last 7 days.</div>
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ══════════════════════════════ DEPOSITS ══════════════════════ */}
      {activeTab === 'deposits' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px 14px' }}>
            <div style={secTitle}>💰 Pending Deposit Verification ({pendingDeposits.length})</div>
            <div style={{ fontSize: 11.5, color: LT.textFaint, marginTop: 4 }}>Current rate: 1 point = {pointRate.toLocaleString()} ៛</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>
                <th style={th}>ID / Date</th>
                <th style={th}>User / Channel</th>
                <th style={th}>Amount</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingDeposits.map(dep => (
                <tr key={dep.id}>
                  <td style={td}>
                    <div style={{ color: LT.text, fontWeight: 600 }}>{dep.id}</div>
                    <div style={{ fontSize: 11, color: LT.textFaint, marginTop: 3 }}>{formatDateTime(dep.timestamp)}</div>
                  </td>
                  <td style={td}>
                    <div>{dep.user}</div>
                    <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 3 }}>{dep.method}</div>
                  </td>
                  <td style={{ ...td, color: '#22c55e', fontWeight: 700 }}>
                    {dep.amount?.toLocaleString()} ៛ → {Math.floor((dep.amount || 0) / pointRate)} pts
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => setSelectedSlipUrl(dep.slipUrl)} style={{ background: 'rgba(124,92,255,0.14)', border: '1px solid #7c5cff', color: '#fbbf24', padding: '6px 12px', borderRadius: 6, marginRight: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>🖼️ View Slip</button>
                    <button onClick={() => handleVerifyDeposit(dep.id, 'approve')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, marginRight: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Approve</button>
                    <button onClick={() => handleVerifyDeposit(dep.id, 'reject')} style={{ background: '#e11d48', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pendingDeposits.length === 0 && (
            <div style={{ color: LT.textFaint, textAlign: 'center', padding: 40, fontSize: 14 }}>No pending deposits at the moment.</div>
          )}
        </Card>
      )}

      {/* ══════════════════════════════ PRODUCTS ══════════════════════ */}
      {activeTab === 'bakong' && <BakongTester />}

      {activeTab === 'products' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: LT.text }}>Inventory Products ({products.length})</div>
            <Link to="/admin-upload" style={{ background: '#7c5cff', color: '#fff', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>+ Add Product</Link>
          </div>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Product Title</th>
                  <th style={th}>Price (pts)</th>
                  <th style={{ ...th, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, i) => (
                  <tr key={product._id}>
                    <td style={{ ...td, color: LT.textFaint }}>{i + 1}</td>
                    <td style={{ ...td, color: LT.text, fontWeight: 700 }}>{product.title}</td>
                    <td style={{ ...td, color: '#22c55e', fontWeight: 700 }}>{product.priceInPoints} pts</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => handleDeleteProduct(product._id)} style={{ background: 'none', border: '1px solid #7f1d2b', color: '#fb7185', cursor: 'pointer', fontWeight: 700, padding: '5px 13px', borderRadius: 6, fontSize: 12 }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && (
              <div style={{ color: LT.textFaint, textAlign: 'center', padding: 40, fontSize: 14 }}>No products yet. Add your first product!</div>
            )}
          </Card>
        </>
      )}

      {/* ── Slip Modal ────────────────────────────────────────────────── */}
      {selectedSlipUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(17,24,39,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: LT.card, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.55)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, color: LT.text, fontWeight: 800 }}>Verify Deposit Slip</h3>
              <button onClick={() => setSelectedSlipUrl(null)} style={{ background: 'none', border: 'none', color: LT.textMuted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ width: '100%', maxHeight: 480, overflowY: 'auto', background: LT.bg, borderRadius: 10, border: `1px solid ${LT.border}`, padding: 8, boxSizing: 'border-box' }}>
              <img src={selectedSlipUrl} alt="Deposit Slip" style={{ width: '100%', display: 'block', borderRadius: 8 }} />
            </div>
            <button onClick={() => setSelectedSlipUrl(null)} style={{ background: LT.accent, color: '#fff', padding: 11, border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
