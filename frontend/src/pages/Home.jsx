import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productGridLayoutSchema } from '../styles/theme';
import { ProductCard } from '../components/ProductCard';
import { AutoSlideBanner } from '../components/AutoSlideBanner';
import { fetchSettings, resolveBannerUrl } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function Home({ products, transactions, memberCount = 0, orderCount = 0 }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const productCount = products.length;
  const [settings, setSettings] = useState({ siteName: 'Masatoshi', telegramUrl: 'https://t.me/xCloudStudio', discordUrl: 'https://discord.gg/' });

  useEffect(() => {
    fetchSettings().then(data => { if (data) setSettings(data); }).catch(() => {});
  }, []);

  // Auto-slide banner images.
  // Preferred source: settings.bannerImages, managed by the admin from
  // Admin Panel → 🖼️ Banners (upload/reorder/delete — stored in Mongo, no
  // redeploy needed). If the admin hasn't set any banners yet, we fall back
  // to the legacy static files in /frontend/public/img (banner1.jpg,
  // banner2.jpg, etc — any of jpg/jpeg/png/webp), probed since the browser
  // can't list a folder's contents directly.
  const [bannerImages, setBannerImages] = useState([]);

  useEffect(() => {
    if (Array.isArray(settings.bannerImages) && settings.bannerImages.length > 0) {
      // settings.bannerImages holds relative paths like "/img/banner-xxx.jpg"
      // as saved by the backend — resolve them against the backend's own
      // origin (same helper the admin panel already uses) so they load
      // correctly even when the storefront runs on a different port/domain
      // than the API (e.g. localhost:5173 storefront vs localhost:5000 API).
      setBannerImages(settings.bannerImages.map(resolveBannerUrl));
      return;
    }
    // No admin-managed banners yet — fall back to probing static files.
    const MAX_SLOTS = 12;
    const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    const probeSlot = (slot) => new Promise(resolve => {
      let i = 0;
      const tryNext = () => {
        if (i >= EXTENSIONS.length) return resolve(null); // no file for this slot
        const src = `/img/banner${slot}.${EXTENSIONS[i]}`;
        const img = new Image();
        img.onload = () => resolve(src);
        img.onerror = () => { i += 1; tryNext(); };
        img.src = src;
      };
      tryNext();
    });

    let cancelled = false;
    Promise.all(Array.from({ length: MAX_SLOTS }, (_, n) => probeSlot(n + 1)))
      .then(results => {
        if (!cancelled) setBannerImages(results.filter(Boolean));
      });
    return () => { cancelled = true; };
  }, [settings.bannerImages]);

  return (
    <div style={{ backgroundColor: colors.bgDark, color: colors.textMain, minHeight: '60vh', transition: 'background-color 0.2s ease, color 0.2s ease' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '80px 20px 60px 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(128,128,128,0.08)', border: `1px solid ${colors.border}`, borderRadius: '999px', padding: '7px 18px', marginBottom: '32px', color: colors.textMuted, fontSize: '13px' }}>
          ⭐ {t('home.badge')} {settings.siteName}
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: '900', margin: '0 0 16px 0' }}>
          {t('home.title1')} <span style={{ color: '#7c6ddb' }}>{settings.siteName}</span> {t('home.title2')}
        </h1>
        <p style={{ color: colors.textMuted, fontSize: '15px', marginBottom: '40px' }}>
          {t('home.subtitle')} {settings.siteName}{t('home.subtitleTail')}
        </p>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href={settings.discordUrl} target="_blank" rel="noreferrer" className="xc-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#5865F2', color: '#fff', padding: '13px 26px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            {t('home.joinDiscord')}
          </a>
          <a href={settings.telegramUrl} target="_blank" rel="noreferrer" className="xc-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#229ED9', color: '#fff', padding: '13px 26px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            {t('home.telegram')}
          </a>
          <Link to="/products" className="xc-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#7c6ddb', color: '#fff', padding: '13px 26px', borderRadius: '10px', fontWeight: '700', fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            {t('home.viewProducts')}
          </Link>
        </div>
      </div>

      {/* Auto-sliding banner — contained within the page's max-width, with
          left/right side margins (no longer edge-to-edge full-bleed) */}
      {bannerImages.length > 0 && (
        <div style={{ maxWidth: '1200px', margin: '0 auto 60px auto', padding: '0 20px' }}>
          <AutoSlideBanner images={bannerImages} intervalMs={5000} rounded={true} aspectRatio={1902 / 688} />
        </div>
      )}

      {/* Products Grid */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '18px', fontWeight: '700', color: colors.textMuted }}>
          {t('home.newestProducts')}
        </h2>
        <div style={productGridLayoutSchema}>
          {products.map(item => <ProductCard key={item._id} item={item} />)}
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: '1200px', margin: '80px auto 40px auto', padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '80px' }}>
          {[
            { count: productCount, label: t('home.stat.products') },
            { count: orderCount,   label: t('home.stat.orders') },
            { count: memberCount,  label: t('home.stat.members') },
          ].map(({ count, label }) => (
            <div key={label} className="xc-stat-card" style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: '800', color: colors.textMain, marginBottom: '6px' }}>{count}</div>
              <div style={{ fontSize: '12px', color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Leadership */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: colors.textMain, marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {t('home.leadership')} {settings.siteName}
          </h2>
          <div className="xc-leader-card" style={{ display: 'inline-block', background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '32px 48px', minWidth: '240px', textAlign: 'center' }}>
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 16px auto', border: `2px solid ${colors.border}` }}>
              <img src="/img/leader.jpg" alt={settings.siteName} onError={e => { e.currentTarget.src = 'https://i.imgur.com/B9P6w0t.jpeg'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: colors.textMain, marginBottom: '4px' }}>{settings.siteName}</div>
            <div style={{ fontSize: '13px', color: '#d97706', fontWeight: '600' }}>{t('home.ownerDeveloper')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
