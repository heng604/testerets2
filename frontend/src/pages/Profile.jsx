import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { OwnedProductCard } from '../components/ProductCard';
import Topup from './Topup';
import { fetchUserAvatar, updateUserAvatar, fetchPurchasesByEmail, fetchSettings } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

import { formatDateTime } from '../utils/dateUtils';

export default function Profile({ userEmail, userPoints, setUserPoints, purchasedItems, products, pendingDeposits, setPendingDeposits, transactions, setTransactions, handleLogout }) {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('products');
  const [pointRate, setPointRate] = useState(100);
  const [avatarSrc, setAvatarSrc] = useState(() => {
    try { return localStorage.getItem('userAvatar_' + userEmail) || null; } catch { return null; }
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  // Load the admin-configured point → KHR rate so the balance shown here
  // always matches what's set in Admin → Settings (instead of an assumed 100).
  useEffect(() => {
    fetchSettings()
      .then(data => { if (data && data.pointRate > 0) setPointRate(data.pointRate); })
      .catch(() => {});
  }, []);

  // Purchased products are loaded from the database (not localStorage), so the
  // "Download" → "Update" switch persists across devices/browsers and can only
  // be lost if an admin deletes the product or purchase record. Clicking
  // "Update" navigates to the product page, where the update is actually
  // acknowledged once the user downloads the new version.
  const [myPurchases, setMyPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  const loadPurchases = useCallback(() => {
    if (!userEmail) { setLoadingPurchases(false); return; }
    setLoadingPurchases(true);
    fetchPurchasesByEmail(userEmail)
      .then(data => setMyPurchases(Array.isArray(data) ? data : []))
      .catch(() => setMyPurchases([]))
      .finally(() => setLoadingPurchases(false));
  }, [userEmail]);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  useEffect(() => {
    if (!userEmail) return;
    fetchUserAvatar(userEmail).then(data => {
      if (data && data.avatar) {
        setAvatarSrc(data.avatar);
        try { localStorage.setItem('userAvatar_' + userEmail, data.avatar); } catch {}
      }
    }).catch(() => {});
  }, [userEmail]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('សូមជ្រើសរើសរូបភាព (JPG, PNG, GIF...)'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('រូបភាពត្រូវតែតូចជាង 2MB'); return; }
    setAvatarUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setAvatarSrc(base64);
      try { localStorage.setItem('userAvatar_' + userEmail, base64); } catch {}
      updateUserAvatar(userEmail, base64).catch(() => {});
    } catch (err) {
      alert('ការផ្លាស់ប្តូររូបភាពបរាជ័យ: ' + err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogoutAndRedirect = () => {
    if (handleLogout) handleLogout();
    navigate('/login');
  };

  const TABS = [
    { key: 'products',     label: t('profile.tab.products'), icon: '🛍️' },
    { key: 'topup',        label: t('profile.tab.topup'),     icon: '💳' },
    { key: 'transactions', label: t('profile.tab.transactions'), icon: '🧾' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: colors.bgDark, color: colors.textMain, padding: '32px 20px', fontFamily: "'Hanuman','Khmer','Segoe UI',Tahoma,Geneva,Verdana,sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Profile Header */}
        <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 20, padding: '28px 32px', marginBottom: 28, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                onClick={() => !avatarUploading && avatarInputRef.current && avatarInputRef.current.click()}
                title={t('profile.changePhoto')}
                style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '2px solid #d97706', cursor: 'pointer', background: 'linear-gradient(135deg,#1a3a5c,#2d6a9f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, position: 'relative' }}
              >
                {avatarSrc ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🧑</span>}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '28px', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📷</div>
              </div>
              {avatarUploading && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fbbf24' }}>{t('profile.saving')}</div>
              )}
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.textMain }}>{userEmail || 'Guest User'}</div>
              <div style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{t('profile.loggedInAccount')}</div>
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{t('profile.clickToChange')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ background: '#0f172a', border: '1px solid #f0a500', borderRadius: 20, padding: '10px 20px', color: '#f0a500', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🪙 {(userPoints || 0).toLocaleString()} Point
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, textAlign: 'right' }}>
              ≈ {((userPoints || 0) * pointRate).toLocaleString()} ៛ ({t('profile.rateNoteDynamic', { rate: pointRate.toLocaleString() })})
            </div>
            <button
              onClick={handleLogoutAndRedirect}
              style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', padding: '10px 22px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              🚪 {t('profile.logout')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="xc-tab"
              style={{ background: activeTab === tab.key ? (tab.key === 'topup' ? '#3b82f6' : tab.key === 'transactions' ? '#22c55e' : '#d97706') : colors.bgCard, border: '1px solid ' + (activeTab === tab.key ? 'transparent' : colors.border), color: colors.textMain, padding: '11px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'products' && (
          loadingPurchases
            ? <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 56, textAlign: 'center', color: colors.textMuted }}>
                <div style={{ fontSize: 14 }}>{t('profile.loading')}</div>
              </div>
            : myPurchases.length > 0
            ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
                {myPurchases.map(p => (
                  <OwnedProductCard
                    key={p.purchaseId}
                    item={p.product}
                    needsUpdate={p.needsUpdate}
                  />
                ))}
              </div>
            : <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 56, textAlign: 'center', color: colors.textMuted }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🛍️</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('profile.noProducts')}</div>
                <div style={{ fontSize: 13 }}>{t('profile.noProductsSub')}</div>
              </div>
        )}

        {activeTab === 'topup' && (
          <Topup userEmail={userEmail} pendingDeposits={pendingDeposits} setPendingDeposits={setPendingDeposits} setTransactions={setTransactions} />
        )}

        {activeTab === 'transactions' && (() => {
          const userTxs = transactions.filter(tx => tx.user === userEmail).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          if (userTxs.length === 0) return (
            <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 48, textAlign: 'center', color: colors.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t('profile.noTransactions')}</div>
            </div>
          );
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {userTxs.map((tx, idx) => {
                const isTopup = tx.type === 'topup';
                const isPending = tx.status === 'pending';
                const isApproved = tx.status === 'approved' || tx.status === 'completed';
                // Use the points actually credited for this transaction — it was
                // computed server-side using whatever exchange rate the admin had
                // set at the moment this deposit was approved, so it always
                // matches the real payout even if the rate has changed since.
                const pointsAdded = isTopup ? (tx.points != null ? tx.points : null) : null;
                const statusColor = isApproved ? '#22c55e' : isPending ? '#fbbf24' : '#ef4444';
                const statusLabel = isApproved ? t('profile.status.approved') : isPending ? t('profile.status.pending') : t('profile.status.rejected');
                return (
                  <div key={tx.id || idx} className="xc-tx-row" style={{ background: colors.bgCard, border: '1px solid ' + (isApproved ? 'rgba(34,197,94,0.2)' : isPending ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)'), borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: isTopup ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {isTopup ? '💳' : '🛍️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: colors.textMain }}>{isTopup ? t('profile.topupTx') + (tx.method || 'ABA/Bakong') : t('profile.purchaseTx') + (tx.title || t('profile.product'))}</div>
                      <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{formatDateTime(tx.timestamp)}{tx.id ? ' · ID: ' + tx.id : ''}</div>
                      {isTopup && isApproved && (
                        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                          Paid {(parseFloat(tx.amount) || 0).toLocaleString()} {tx.currency === 'USD' ? '$' : '៛'}
                          {tx.pointRateUsed ? ` · rate: ${Number(tx.pointRateUsed).toLocaleString()} / pt` : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: isTopup ? '#38bdf8' : '#ef4444' }}>
                        {isTopup
                          ? (isApproved
                              ? '+' + (pointsAdded != null ? pointsAdded : '?') + ' ' + t('productDetail.points')
                              : (parseFloat(tx.amount) || 0).toLocaleString() + ' ៛')
                          : '-' + tx.amount + ' ' + t('productDetail.points')}
                      </div>
                      <div style={{ marginTop: 6, display: 'inline-block', background: statusColor + '18', border: '1px solid ' + statusColor + '44', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: statusColor }}>
                        {statusLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
