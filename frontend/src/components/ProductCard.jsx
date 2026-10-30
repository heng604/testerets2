import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ProductLabel from './ProductLabel';

export function ProductCard({ item }) {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="xc-card" style={{ background: colors.bgCard, borderRadius: '12px', border: `1px solid ${colors.border}`, boxShadow: colors.cardShadow, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="xc-card-img-wrap" style={{ position: 'relative', width: '100%', height: '220px' }}>
        <img src={item.images[0]} alt="" className="xc-card-img" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: item.label === 'out_of_stock' ? 'grayscale(0.85) brightness(0.55)' : 'none' }} />
        <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(4, 4, 6, 0.8)', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', color: '#fbbf24', fontWeight: '600' }}>
          {t('productCard.by')} {item.ownerName || 'Masatoshi'}
        </div>
        {(item.label && item.label !== 'none') ? (
          <div style={{ position: 'absolute', top: '10px', left: '10px' }}><ProductLabel label={item.label} /></div>
        ) : (item.isNew && (
          <div style={{ position: 'absolute', top: '10px', left: '10px' }}><ProductLabel label="new_arrival" /></div>
        ))}
      </div>
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px 0', color: colors.textMain }}>{item.title}</h3>
          <p style={{ fontSize: '12px', color: '#f59e0b', margin: '0 0 14px 0' }}>{item.description}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '14px', borderTop: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '800', display: 'flex', alignItems: 'center', gap: 6 }}>
            🪙 {(item.priceInPoints || 0).toLocaleString()}
            {item.discountPercent > 0 && (
              <span style={{ fontSize: '11px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '2px 7px', fontWeight: 700 }}>
                -{item.discountPercent}%
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/mod/' + item._id)}
            className="xc-btn xc-view-btn"
            style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 5, color: colors.textMuted, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            {t('productCard.viewDetails')} <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function OwnedProductCard({ item, needsUpdate }) {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [downloading, setDownloading] = React.useState(false);

  const image = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '';
  const price = typeof item.priceInPoints === 'number' ? item.priceInPoints : 0;
  const owner = item.ownerName || 'Masatoshi';
  const id = item._id || '';
  const dlUrl = item.downloadUrl || '';

  // needsUpdate comes from the server (mod.lastUpdatedAt vs purchase.notifiedUpdateAt in the
  // database), not localStorage — so it persists across devices/browsers and can only be
  // cleared by the admin, or by the user acknowledging the update on the product page.
  const isAdminUpdated = !!needsUpdate;

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!dlUrl) { alert(t('productCard.noDownloadLink')); return; }
    setDownloading(true);
    window.open(dlUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => setDownloading(false), 2000);
  };

  const handleUpdate = (e) => {
    e.stopPropagation();
    // Don't acknowledge yet — navigate to the product page, which shows its own
    // "new version" button and only marks the update as seen once the user
    // actually clicks to download (see ProductDetail.jsx).
    // fromProfile=true tells the product page this visit came from Profile, so
    // it keeps showing Download (never "ទិញម្ដងទៀត"/Buy Again) here.
    navigate('/mod/' + id, { state: { fromProfile: true } });
  };

  return (
    <div className="xc-owned-card" style={{ background: colors.bgCard, borderRadius: '14px', border: isAdminUpdated ? '1px solid rgba(245,158,11,0.5)' : `1px solid ${colors.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: isAdminUpdated ? '0 4px 24px rgba(245,158,11,0.12)' : (colors.mode === 'light' ? colors.cardShadow : '0 4px 24px rgba(217,119,6,0.08)') }}>
      <div style={{ position: 'relative', width: '100%', height: '200px', flexShrink: 0 }}>
        {image
          ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
          : <div style={{ width: '100%', height: '100%', background: colors.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 13 }}>{t('productCard.noImage')}</div>
        }
        <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
          ✅ {t('productCard.purchased')}
        </div>
        {isAdminUpdated && (
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(245,158,11,0.95)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, animation: 'pulse 1.5s infinite' }}>
            🔔 Admin Updated
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(4,4,6,0.75)', padding: '4px 10px', borderRadius: 6, fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
          {t('productCard.by')} {owner}
        </div>
      </div>

      <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', color: colors.textMain }}>{item.title || t('productCard.noTitle')}</h3>
          <p style={{ fontSize: 12, color: colors.textMuted, margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.description || ''}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ color: '#22c55e', fontWeight: 800, fontSize: 13 }}>🪙 {price.toLocaleString()} {t('productCard.points')}</span>
          <button onClick={() => id && navigate('/mod/' + id, { state: { fromProfile: true } })} style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
            {t('productCard.details')} ➜
          </button>
        </div>

        {/* Yellow Update button if admin updated, otherwise green Download */}
        {isAdminUpdated ? (
          <button
            onClick={handleUpdate}
            style={{
              marginTop: 4, width: '100%', padding: '13px 0', borderRadius: 10, border: '2px solid #f59e0b',
              fontWeight: 800, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'linear-gradient(135deg,#d97706,#f59e0b)',
              color: '#fff',
              boxShadow: '0 2px 16px rgba(245,158,11,0.35)',
              animation: 'pulse 2s infinite',
            }}
          >
            <span style={{ fontSize: 16 }}>🔄</span> {t('productCard.updateProduct')}
          </button>
        ) : (
          <button
            onClick={handleDownload}
            disabled={downloading || !dlUrl}
            style={{
              marginTop: 4, width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
              fontWeight: 800, fontSize: 14, cursor: downloading || !dlUrl ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.2s, transform 0.1s',
              background: !dlUrl ? '#1e293b' : downloading ? 'linear-gradient(135deg,#166534,#15803d)' : 'linear-gradient(135deg,#16a34a,#22c55e)',
              color: !dlUrl ? '#475569' : '#fff',
              boxShadow: dlUrl && !downloading ? '0 2px 12px rgba(34,197,94,0.25)' : 'none',
            }}
            onMouseEnter={e => { if (dlUrl && !downloading) e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            {downloading ? <><span style={{ fontSize: 16 }}>⏳</span> {t('productCard.opening')}</>
              : dlUrl ? <><span style={{ fontSize: 16 }}>⬇️</span> {t('productCard.downloadNow')}</>
                : <><span style={{ fontSize: 16 }}>🔒</span> {t('productCard.noDownload')}</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
