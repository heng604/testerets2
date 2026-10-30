import React, { useState, useEffect } from 'react';
import { XCLOUD_THEME } from '../styles/theme';

function EditOrderModal({ order, onClose, onSave }) {
  const [pointsSpent, setPointsSpent] = useState(order.amount || 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointsSpent: parseFloat(pointsSpent) }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Update failed'); }
      const data = await res.json();
      onSave({ ...order, amount: data.purchase.pointsSpent });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: '#0a0a0f',
    border: '1px solid #1e293b', borderRadius: '8px', color: '#e6edf3',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', color: '#64748b', fontSize: '12px', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1001, background: '#100d1c', border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '16px', padding: '28px 32px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>✏️ កែប្រែការបញ្ជាទិញ</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '22px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#0a0a0f', borderRadius: '10px', border: '1px solid #1e293b' }}>
          <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>USER EMAIL</div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{order.userEmail}</div>
          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '10px', marginBottom: '4px' }}>ផលិតផល</div>
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>{order.title}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>ពិន្ទុបានចំណាយ (Points Spent)</label>
            <input type="number" min="0" value={pointsSpent} onChange={e => setPointsSpent(e.target.value)} style={inputStyle} />
          </div>

          {error && <div style={{ color: '#f87171', fontSize: '12px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '8px', color: '#64748b', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
              បោះបង់
            </button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '12px', background: saving ? '#374151' : '#7c5cff', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '⏳ កំពុងរក្សាទុក...' : '💾 រក្សាទុក'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DeleteOrderModal({ order, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = async () => {
    setError('');
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${order._id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
      onDeleted(order._id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1001, background: '#100d1c', border: '1px solid #7f1d1d', borderRadius: '16px', padding: '28px 32px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗑️</div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: '0 0 8px 0' }}>លុបការបញ្ជាទិញនេះ?</h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            ការទិញផលិតផល <span style={{ color: '#fca5a5', fontWeight: '700' }}>{order.title}</span> ដោយ{' '}
            <span style={{ color: '#fca5a5', fontWeight: '700' }}>{order.userEmail}</span> នឹងត្រូវបានលុបចោល។
            អ្នកប្រើប្រាស់នេះនឹងលែងឃើញផលិតផលនេះនៅក្នុងប្រវត្តិទិញរបស់ខ្លួន និងលែងអាចទាញយកបានទៀត។
            ការលុបនេះមិនប៉ះពាល់ដល់គណនី ឬពិន្ទុរបស់អ្នកប្រើប្រាស់ទេ — ប្រើទំព័រ "អ្នកប្រើប្រាស់" បើចង់ហាមឃាត់ទាំងគណនី។
          </p>
        </div>

        {error && <div style={{ color: '#f87171', fontSize: '12px', textAlign: 'center', marginBottom: '12px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '8px', color: '#64748b', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
            បោះបង់
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{ flex: 2, padding: '12px', background: deleting ? '#374151' : '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: deleting ? 'not-allowed' : 'pointer' }}>
            {deleting ? '⏳ កំពុងលុប...' : '🗑️ លុបចោល'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingOrder, setEditingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);

  const loadOrders = () => {
    setLoading(true);
    fetch('/api/orders')
      .then(r => r.ok ? r.json() : [])
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, []);

  const handleSaveOrder = (updatedOrder) => {
    setOrders(prev => prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o));
  };

  const handleDeletedOrder = (id) => {
    setOrders(prev => prev.filter(o => o._id !== id));
  };

  // Search is by user email specifically — lets an admin pull up everything
  // one problem user bought and go through it one order at a time.
  const filtered = orders.filter(o =>
    (o.userEmail || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '40px 80px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#fff' }}>
          🛍️ ការបញ្ជាទិញ ({filtered.length}{search ? `/${orders.length}` : ''})
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ស្វែងរកតាម email..."
            style={{ padding: '9px 14px', background: '#0a0a0f', border: '1px solid #1e293b', borderRadius: '8px', color: '#e6edf3', fontSize: '13px', outline: 'none', width: '240px' }}
          />
          <button onClick={loadOrders} style={{ padding: '9px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
            🔄 ផ្ទុកឡើងវិញ
          </button>
        </div>
      </div>

      <div style={{ background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0a0a0f', borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>លេខសម្គាល់</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>អ្នកប្រើប្រាស់</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>ផលិតផល</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>ចំនួន</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>កាលបរិច្ឆេទ</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>ស្ថានភាព</th>
              <th style={{ padding: '16px 20px', color: '#64748b', textAlign: 'right' }}>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order, idx) => (
              <tr key={order._id || order.id || idx} className="xc-admin-row" style={{ borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
                <td style={{ padding: '16px 20px', color: '#64748b', fontSize: 11 }}>{order.id || order._id || '—'}</td>
                <td style={{ padding: '16px 20px', color: '#94a3b8' }}>{order.userEmail || order.user || '—'}</td>
                <td style={{ padding: '16px 20px', color: '#fff', fontWeight: 600 }}>{order.title || order.productTitle || '—'}</td>
                <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 700 }}>{(order.amount || 0).toLocaleString()} ពិន្ទុ</td>
                <td style={{ padding: '16px 20px', color: '#475569', fontSize: 12 }}>
                  {order.timestamp ? new Date(order.timestamp).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    {order.status || 'completed'}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                  <button
                    onClick={() => setEditingOrder(order)}
                    style={{ background: 'rgba(124,92,255,0.15)', border: '1px solid rgba(124,92,255,0.3)', color: '#fbbf24', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', marginRight: '8px' }}
                  >
                    ✏️ កែប្រែ
                  </button>
                  <button
                    onClick={() => setDeletingOrder(order)}
                    style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                  >
                    🗑️ លុប
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div style={{ color: '#475569', textAlign: 'center', padding: '30px' }}>កំពុងផ្ទុក...</div>}
        {!loading && filtered.length === 0 && <div style={{ color: '#475569', textAlign: 'center', padding: '30px' }}>មិនមានការបញ្ជាទិញណាមួយទេ។</div>}
      </div>

      {editingOrder && (
        <EditOrderModal order={editingOrder} onClose={() => setEditingOrder(null)} onSave={handleSaveOrder} />
      )}
      {deletingOrder && (
        <DeleteOrderModal order={deletingOrder} onClose={() => setDeletingOrder(null)} onDeleted={handleDeletedOrder} />
      )}
    </div>
  );
}
