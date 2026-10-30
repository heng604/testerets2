import ProductLabel from '../components/ProductLabel';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { XCLOUD_THEME } from '../styles/theme';
import { deleteProduct, clearProductUpdate } from '../services/api';
import EditProductModal from './EditProductModal';

const MS_24H = 24 * 60 * 60 * 1000;

function hasActiveUpdate(product) {
  if (!product.lastUpdatedAt) return false;
  const age = Date.now() - new Date(product.lastUpdatedAt).getTime();
  // epoch 0 means manually cleared; also expire after 24h (matches backend logic)
  return new Date(product.lastUpdatedAt).getTime() > 0 && age < MS_24H;
}

export default function Products({ products, setProducts }) {
  const [editingProduct, setEditingProduct] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [clearingId, setClearingId] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('តើអ្នកពិតជាចង់លុបផលិតផល Mod នេះមែនទេ?')) return;
    try {
      const res = await deleteProduct(id);
      if (!res.ok) throw new Error('Delete failed');
      setProducts(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      alert('ការលុបបរាជ័យ — សូមព្យាយាមម្តងទៀត។');
    }
  };

  const handleSave = (updatedProduct) => {
    setProducts(prev => prev.map(p => p._id === updatedProduct._id ? updatedProduct : p));
    setSuccessMsg(`✅ "${updatedProduct.title}" ត្រូវបានអាប់ដេតដោយជោគជ័យ!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleClearUpdate = async (product) => {
    if (!window.confirm(`លុបការជូនដំណឹង Update សម្រាប់ "${product.title}" ចេញពីអ្នកទិញទាំងអស់?`)) return;
    setClearingId(product._id);
    try {
      const res = await clearProductUpdate(product._id);
      if (!res.ok) throw new Error('Clear failed');
      // Set lastUpdatedAt to epoch 0 locally so the badge disappears immediately
      setProducts(prev => prev.map(p =>
        p._id === product._id ? { ...p, lastUpdatedAt: new Date(0).toISOString() } : p
      ));
      setSuccessMsg(`🔕 "${product.title}" — ការជូនដំណឹងត្រូវបានលុបចោល!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert('បរាជ័យ — សូមព្យាយាមម្តងទៀត។');
    } finally {
      setClearingId(null);
    }
  };

  return (
    <div style={{ padding: '40px 80px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Success Toast */}
      {successMsg && (
        <div style={{
          position: 'fixed', top: '20px', right: '24px', zIndex: 9999,
          background: 'linear-gradient(135deg, #065f46, #047857)',
          border: '1px solid #10b981', borderRadius: '12px',
          padding: '14px 22px', color: '#fff', fontWeight: '700', fontSize: '14px',
          boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
          animation: 'fadeIn 0.3s ease',
          display: 'flex', alignItems: 'center', gap: '8px',
          maxWidth: '380px',
        }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#fff' }}>
          📦 ផលិតផលក្នុងប្រព័ន្ធ ({products.length})
        </h2>
        <Link to="/admin-upload" style={{ background: XCLOUD_THEME.accentPurple, color: '#fff', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: '700' }}>
          + បន្ថែមផលិតផល
        </Link>
      </div>

      <div style={{ background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#0a0a0f', borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>រូបភាព</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>ចំណងជើង</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>តម្លៃ</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>បញ្ចុះតម្លៃ</th>
              <th style={{ padding: '16px 20px', color: '#64748b', textAlign: 'right' }}>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => {
              const activeUpdate = hasActiveUpdate(product);
              return (
                <tr key={product._id} className="xc-admin-row" style={{ borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
                  <td style={{ padding: '12px 20px' }}>
                    {product.images?.[0] && (
                      <img src={product.images[0]} alt="" style={{ width: 56, height: 44, objectFit: 'cover', borderRadius: 6, border: `1px solid ${XCLOUD_THEME.border}` }} />
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: '700', color: '#fff' }}>
                    {product.title}
                    {product.label && product.label !== 'none' && <span style={{ marginLeft: 8 }}><ProductLabel label={product.label} /></span>}
                    {activeUpdate && (
                      <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 20, padding: '2px 8px', fontWeight: 600, verticalAlign: 'middle' }}>
                        🔔 Update Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: '700' }}>{product.priceInPoints} ពិន្ទុ</td>
                  <td style={{ padding: '16px 20px', color: '#a78bfa' }}>
                    {product.discountCode
                      ? <span>{product.discountCode} ({product.discountPercent || 0}%)</span>
                      : <span style={{ color: '#475569' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                      {activeUpdate && (
                        <button
                          onClick={() => handleClearUpdate(product)}
                          disabled={clearingId === product._id}
                          title="លុបការជូនដំណឹង Update ចេញពីអ្នកទិញទាំងអស់"
                          style={{
                            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                            color: '#fbbf24', padding: '6px 12px', borderRadius: '4px',
                            cursor: clearingId === product._id ? 'not-allowed' : 'pointer',
                            fontWeight: '600', fontSize: '12px', opacity: clearingId === product._id ? 0.6 : 1,
                          }}
                        >
                          {clearingId === product._id ? '⏳' : '🔕'} Clear Update
                        </button>
                      )}
                      <button
                        onClick={() => setEditingProduct(product)}
                        style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#fbbf24', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        ✏️ កែប្រែ
                      </button>
                      <Link to={`/mod/${product._id}`} style={{ background: 'rgba(124,92,255,0.15)', border: '1px solid rgba(124,92,255,0.3)', color: '#fbbf24', padding: '6px 12px', borderRadius: '4px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>
                        មើល
                      </Link>
                      <button
                        onClick={() => handleDelete(product._id)}
                        style={{ background: 'none', border: `1px solid rgba(239,68,68,0.3)`, color: XCLOUD_THEME.accentDanger, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                      >
                        លុប
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && (
          <div style={{ color: '#475569', textAlign: 'center', padding: '40px', fontSize: '14px' }}>មិនមានផលិតផលណាមួយទេ។</div>
        )}
      </div>

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
