import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { inputStyle, productGridLayoutSchema } from '../styles/theme';
import { ProductCard } from '../components/ProductCard';
import { purchaseProduct, fetchPurchasesByEmail, acknowledgeProductUpdate, markPurchaseDownloaded } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ProductLabel from '../components/ProductLabel';

export default function ProductDetail({ products, userPoints, setUserPoints, purchasedItems, setPurchasedItems, setTransactions, userEmail }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { colors: XCLOUD_THEME } = useTheme();
  const { t } = useLanguage();
  const product = products.find(p => String(p._id) === String(id));

  // True only when this page was opened via a link from the Profile page
  // (see ProductCard.jsx's OwnedProductCard, which sets this in navigate state).
  // When true, the Download button always stays Download and never switches to
  // "ទិញម្ដងទៀត" (Buy Again), regardless of the purchase's `downloaded` flag.
  const fromProfile = !!location.state?.fromProfile;

  const [activeTab, setActiveTab] = useState('details');
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [discountMultiplier, setDiscountMultiplier] = useState(1);

  // Database-backed purchase record for THIS product, mirroring the Profile page logic.
  // This is the single source of truth for "does this user own this product, and does
  // the admin's latest edit still need to be acknowledged" — not the localStorage-derived
  // purchasedItems list, which only knows ownership, not update status.
  const [myPurchase, setMyPurchase] = useState(null); // { purchaseId, needsUpdate, product } | null
  const [loadingOwnership, setLoadingOwnership] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [buyingAgain, setBuyingAgain] = useState(false);

  const loadOwnership = useCallback(() => {
    if (!userEmail || !product) { setLoadingOwnership(false); return; }
    setLoadingOwnership(true);
    fetchPurchasesByEmail(userEmail)
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        const match = list.find(p => String(p.product?._id) === String(product._id));
        setMyPurchase(match || null);
        console.log(`[ProductDetail] "${product.title}" owned=${!!match} needsUpdate=${!!match?.needsUpdate}`);
      })
      .catch(() => setMyPurchase(null))
      .finally(() => setLoadingOwnership(false));
  }, [userEmail, product]);

  useEffect(() => { loadOwnership(); }, [loadOwnership]);

  // Auto-acknowledge: when needsUpdate=true, silently stamp notifiedUpdateAt
  // so the button switches to Download on its own. A ref guard fires it once only.
  const acknowledgedRef = React.useRef(false);
  useEffect(() => {
    if (!myPurchase?.needsUpdate || !myPurchase?.purchaseId) return;
    if (acknowledgedRef.current) return;
    acknowledgedRef.current = true;
    acknowledgeProductUpdate(myPurchase.purchaseId)
      .catch(() => {})
      .finally(() => loadOwnership());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPurchase?.purchaseId, myPurchase?.needsUpdate]);

  if (!product) return <div style={{ padding: '80px', color: XCLOUD_THEME.textMuted, textAlign: 'center' }}>{t('productDetail.notFound')}</div>;

  const isReallyOwned = !!myPurchase || purchasedItems.includes(product._id);
  const needsUpdate = !!myPurchase?.needsUpdate;
  // Has this specific purchase already been downloaded once from THIS product
  // page? Only relevant when NOT arriving from Profile — Profile's own
  // Download button is separate and always stays available regardless.
  const alreadyDownloaded = !fromProfile && !!myPurchase?.downloaded;
  const finalPrice = Math.round(product.priceInPoints * discountMultiplier);
  const productImages = product.images && product.images.length > 0 ? product.images : ['https://i.imgur.com/B9P6w0t.jpeg'];

  const handlePrevImage = () => setCurrentImgIndex(prev => prev === 0 ? productImages.length - 1 : prev - 1);
  const handleNextImage = () => setCurrentImgIndex(prev => prev === productImages.length - 1 ? 0 : prev + 1);

  const applyPromo = () => {
    if (product.discountCode && promoCode.toUpperCase() === product.discountCode.toUpperCase()) {
      const percent = product.discountPercent || 50;
      setDiscountMultiplier(1 - percent / 100);
      alert(`បានអនុវត្តជោគជ័យ! ទទួលបានការបញ្ចុះតម្លៃ ${percent}% រួចរាល់ហើយ។`);
    } else {
      alert('លេខកូដបញ្ចុះតម្លៃមិនត្រឹមត្រូវ ឬមិនអាចប្រើជាមួយផលិតផលនេះបានទេ។');
    }
  };

  const handlePurchase = async (force = false) => {
    if (isReallyOwned && !force) return; // already owned — the Download/Update button is already showing
    if (userPoints < finalPrice) { alert('ពិន្ទុរបស់អ្នកមិនគ្រប់គ្រាន់ទេ សូមបំពេញបន្ថែមប្រាក់ជាមុនសិន។'); return; }
    try {
      if (!userEmail) { alert('Purchase failed: please log in again.'); return; }
      const res = await purchaseProduct(product._id, userEmail, finalPrice);
      if (!res.ok) { const err = await res.json(); alert('Purchase failed: ' + (err.error || 'Server error')); return; }
      const data = await res.json();
      if (data.user && typeof data.user.points === 'number') setUserPoints(data.user.points);
      else setUserPoints(prev => prev - finalPrice);
    } catch (e) {
      alert('Purchase failed: could not reach the server. Please try again.');
      return;
    }
    setPurchasedItems(prev => prev.includes(product._id) ? prev : [...prev, product._id]);
    setTransactions(prev => [{ id: 'TX-' + Date.now(), type: 'purchase', title: product.title, amount: finalPrice, currency: 'points', status: 'completed', timestamp: new Date().toISOString() }, ...prev]);
    loadOwnership(); // pick up the freshly-created purchase record from the database — switches the button to Download immediately
    alert('ទិញផលិតផលបានជោគជ័យ! សូមអរគុណចំពោះការគាំទ្រសេវាកម្មរបស់យើង។');
  };

  const handleAcknowledgeAndDownload = async () => {
    if (!myPurchase?.purchaseId) return;
    setAcknowledging(true);
    try {
      await acknowledgeProductUpdate(myPurchase.purchaseId);
    } catch {}
    setAcknowledging(false);
    loadOwnership();
    if (product.downloadUrl) window.open(product.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  // First (and only) free download from THIS product page for the current
  // purchase. Opens the file, then stamps downloaded=true so this same
  // purchase's button switches to "ទិញម្ដងទៀត" (Buy Again) afterwards —
  // unless this page was reached from Profile, in which case Download always
  // stays available (see `fromProfile`/`alreadyDownloaded` above).
  const handleDownloadOnce = async () => {
    if (product.downloadUrl) window.open(product.downloadUrl, '_blank', 'noopener,noreferrer');
    if (!myPurchase?.purchaseId || fromProfile) return; // nothing to stamp, or Profile visit — never lock the button
    setDownloading(true);
    try {
      await markPurchaseDownloaded(myPurchase.purchaseId);
    } catch {}
    setDownloading(false);
    loadOwnership();
  };

  // "ទិញម្ដងទៀត" (Buy Again) — re-purchases the SAME product (deducts points
  // again and creates a brand-new purchase record), so the user can download
  // it again. The new purchase starts undownloaded, so the button goes back
  // to Download right after this succeeds.
  const handleBuyAgain = async () => {
    setBuyingAgain(true);
    try {
      await handlePurchase(true);
    } finally {
      setBuyingAgain(false);
    }
  };

  const recommendedProducts = products.filter(p => p._id !== product._id).slice(0, 4);

  return (
    <div className="xc-page-pad" style={{ background: XCLOUD_THEME.bgDark, color: XCLOUD_THEME.textMain, minHeight: '100vh', padding: 'clamp(20px, 4vw, 40px) 80px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: XCLOUD_THEME.textMuted, marginBottom: '24px' }}>
        <span onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>{t('nav.home')}</span>
        <span>/</span>
        <span onClick={() => navigate('/products')} style={{ cursor: 'pointer' }}>{t('nav.products')}</span>
        <span>/</span>
        <span style={{ color: '#fbbf24' }}>{product.title}</span>
      </div>

      <div className="xc-pd-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: '32px', alignItems: 'start' }}>
        {/* Left: image + tabs */}
        <div>
          <div style={{ position: 'relative', width: '100%', height: '460px', background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}`, overflow: 'hidden' }}>
            <img src={productImages[currentImgIndex]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: product.label === 'out_of_stock' ? 'grayscale(0.85) brightness(0.6)' : 'none' }} />
            {product.label && product.label !== 'none' && (
              <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 4 }}><ProductLabel label={product.label} style={{ fontSize: 12, padding: '6px 12px' }} /></div>
            )}
            <button onClick={handlePrevImage} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(4,4,6,0.75)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', zIndex: 5 }}>◀</button>
            <button onClick={handleNextImage} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(4,4,6,0.75)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', zIndex: 5 }}>▶</button>
            <div style={{ position: 'absolute', top: '16px', left: '16px', background: '#7c5cff', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>💎 {product.title}</div>
            <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 5 }}>
              {productImages.map((_, idx) => (
                <div key={idx} style={{ width: '8px', height: '8px', borderRadius: '50%', background: currentImgIndex === idx ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'background 0.2s' }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', borderBottom: `1px solid ${XCLOUD_THEME.border}`, marginTop: '30px', paddingBottom: '2px' }}>
            {['details', 'screenshots'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'none', border: 'none', color: activeTab === tab ? XCLOUD_THEME.textMain : XCLOUD_THEME.textMuted, fontSize: '14px', fontWeight: '700', paddingBottom: '12px', borderBottom: activeTab === tab ? '2px solid #7c5cff' : '2px solid transparent', cursor: 'pointer' }}>
                {tab === 'details' ? t('productDetail.tab.details') : t('productDetail.tab.screenshots')}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '24px', minHeight: '200px' }}>
            {activeTab === 'details' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {product.description && <div style={{ color: '#fbbf24', fontSize: '14px', lineHeight: '1.5' }}>{product.description}</div>}
                {product.details && product.details.map((detail, idx) => (
                  <div key={idx} style={{ color: '#fbbf24', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#7c5cff', fontSize: '16px' }}>—</span> {detail}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {product.screenshots && product.screenshots.length > 0
                  ? product.screenshots.map((src, idx) => <img key={idx} src={src} alt="" style={{ width: '100%', borderRadius: '8px', border: `1px solid ${XCLOUD_THEME.border}` }} />)
                  : <div style={{ color: XCLOUD_THEME.textMuted, fontSize: '13px' }}>{t('productDetail.noScreenshots')}</div>
                }
              </div>
            )}
          </div>
        </div>

        {/* Right: price + buy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ color: XCLOUD_THEME.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>{t('productDetail.priceInPoints')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '32px', fontWeight: '900', color: '#10b981' }}>{finalPrice.toLocaleString()}</span>
              <span style={{ fontSize: '14px', color: XCLOUD_THEME.textMuted, fontWeight: '700' }}>{t('productDetail.points')}</span>
            </div>
          </div>

          <div style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ color: XCLOUD_THEME.textMuted, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>{t('productDetail.discountCode')}</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder={t('productDetail.discountPlaceholder')} value={promoCode} onChange={e => setPromoCode(e.target.value)} style={{ ...inputStyle, padding: '10px 14px', background: XCLOUD_THEME.bgInput, border: `1px solid ${XCLOUD_THEME.border}`, color: XCLOUD_THEME.textMain }} />
              <button onClick={applyPromo} style={{ background: '#1c1540', border: `1px solid ${XCLOUD_THEME.border}`, color: '#fbbf24', padding: '0 20px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>{t('productDetail.apply')}</button>
            </div>
          </div>

          <div style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { icon: '🔄', title: t('productDetail.perk1Title'), sub: t('productDetail.perk1Sub') },
              { icon: '🌍', title: t('productDetail.perk2Title'), sub: t('productDetail.perk2Sub') },
              { icon: '📥', title: t('productDetail.perk3Title'), sub: t('productDetail.perk3Sub') },
            ].map(({ icon, title, sub }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: XCLOUD_THEME.textMuted }}>
                <span style={{ fontSize: '16px' }}>{icon}</span>
                <div>
                  <span style={{ color: XCLOUD_THEME.textMain, fontWeight: '700' }}>{title}</span>
                  <span style={{ color: XCLOUD_THEME.textMuted, fontSize: '12px', display: 'block' }}>{sub}</span>
                </div>
              </div>
            ))}

            {!isReallyOwned && product.label === 'out_of_stock' ? (
              <button disabled style={{ display: 'block', width: '100%', padding: '14px', background: '#3a2020', color: '#fca5a5', border: '1px solid #7f1d1d', borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: 'not-allowed', letterSpacing: '0.05em' }}>
                OUT OF STOCK
              </button>
            ) : !isReallyOwned ? (
              <button onClick={() => handlePurchase(false)} disabled={loadingOwnership} style={{ display: 'block', width: '100%', padding: '14px', background: '#7c5cff', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: loadingOwnership ? 'not-allowed' : 'pointer', textAlign: 'center', boxSizing: 'border-box' }}>
                🛒 {t('productDetail.buyNow')} - {finalPrice.toLocaleString()} {t('productDetail.points')}
              </button>
            ) : needsUpdate ? (
              <button
                onClick={handleAcknowledgeAndDownload}
                disabled={acknowledging || loadingOwnership}
                style={{ display: 'block', width: '100%', padding: '14px', background: 'linear-gradient(135deg,#7c5cff,#a78bfa)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: (acknowledging || loadingOwnership) ? 'not-allowed' : 'pointer', textAlign: 'center', boxSizing: 'border-box' }}
              >
                {(acknowledging || loadingOwnership) ? t('productDetail.updating') : t('productDetail.newVersion')}
              </button>
            ) : alreadyDownloaded ? (
              <button
                onClick={handleBuyAgain}
                disabled={buyingAgain || loadingOwnership}
                style={{ display: 'block', width: '100%', padding: '14px', background: '#7c5cff', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: (buyingAgain || loadingOwnership) ? 'not-allowed' : 'pointer', textAlign: 'center', boxSizing: 'border-box' }}
              >
                {buyingAgain ? t('productDetail.updating') : `${t('productDetail.buyAgain')} - ${finalPrice.toLocaleString()} ${t('productDetail.points')}`}
              </button>
            ) : (
              <button
                onClick={handleDownloadOnce}
                disabled={downloading}
                style={{ display: 'block', width: '100%', padding: '14px', background: XCLOUD_THEME.accentGreen, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: downloading ? 'not-allowed' : 'pointer', textAlign: 'center', boxSizing: 'border-box' }}
              >
                {t('productDetail.downloadMod')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recommended */}
      <div style={{ marginTop: '80px', borderTop: `1px solid ${XCLOUD_THEME.border}`, paddingTop: '40px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '24px', color: XCLOUD_THEME.textMuted }}>{t('productDetail.recommended')}</h3>
        {recommendedProducts.length > 0
          ? <div style={productGridLayoutSchema}>{recommendedProducts.map(item => <ProductCard key={item._id} item={item} />)}</div>
          : <div style={{ color: XCLOUD_THEME.textMuted, fontSize: '13px' }}>{t('productDetail.noRecommended')}</div>
        }
      </div>
    </div>
  );
}
