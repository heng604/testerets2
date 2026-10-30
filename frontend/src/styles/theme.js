// --- SYSTEM THEMING STYLE CONFIGURATION ---
// Dark mode (original / default) palette
export const DARK_THEME = {
  mode: 'dark',
  bgDark: '#0c0b0a',
  bgCard: '#14110f',
  bgInput: '#0c0a09',
  border: '#2a2420',
  cardShadow: 'none',
  textMain: '#ffffff',
  textMuted: '#94a3b8',
  accentPurple: '#d97706',
  accentGreen: '#10b981',
  accentDanger: '#ef4444',
};

// Light / "normal" mode palette
export const LIGHT_THEME = {
  mode: 'light',
  bgDark: '#f4f5f8',
  bgCard: '#ffffff',
  bgInput: '#eef0f4',
  border: '#c7cbd4',
  cardShadow: '0 1px 3px rgba(15,17,21,0.08), 0 1px 2px rgba(15,17,21,0.05)',
  textMain: '#0f1115',
  textMuted: '#475066',
  accentPurple: '#d97706',
  accentGreen: '#10b981',
  accentDanger: '#ef4444',
};

// Kept for backwards compatibility with components that import XCLOUD_THEME
// directly (they will continue to render in dark mode unless refactored to
// pull colors from ThemeContext via useTheme()).
export const XCLOUD_THEME = DARK_THEME;

// --- GLOBAL SCHEMA OBJECT STYLES ---
export const navLinkStyle = {
  color: '#94a3b8',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '500',
};

export const navTopUpButtonStyle = {
  background: 'rgba(217,119,6, 0.1)',
  border: '1px solid #d97706',
  color: '#fbbf24',
  padding: '6px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  cursor: 'pointer',
};

export const productGridLayoutSchema = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '24px',
};

export const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  background: XCLOUD_THEME.bgInput,
  border: `1px solid ${XCLOUD_THEME.border}`,
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

export const labelStyle = {
  display: 'block',
  fontSize: '12px',
  color: '#94a3b8',
  marginBottom: '6px',
  fontWeight: '600',
};

// --- INJECT GLOBAL HOVER + PRESS ANIMATION CSS ---
export function injectGlobalStyles() {
  if (typeof document !== 'undefined' && !document.getElementById('xcloud-anim-styles')) {
    const s = document.createElement('style');
    s.id = 'xcloud-anim-styles';
    s.textContent = `
      .xc-card {
        transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease !important;
        cursor: pointer;
      }
      .xc-card:hover {
        transform: translateY(-8px) scale(1.02) !important;
        box-shadow: 0 24px 60px rgba(217,119,6,0.28), 0 8px 20px rgba(0,0,0,0.6) !important;
        border-color: #d97706 !important;
      }
      .xc-card:active {
        transform: translateY(-4px) scale(0.99) !important;
        transition: transform 0.08s ease !important;
      }
      .xc-card-img { transition: transform 0.35s ease !important; }
      .xc-card-img-wrap { overflow: hidden; }
      .xc-card:hover .xc-card-img { transform: scale(1.07) !important; }
      .xc-card:hover .xc-view-btn { background: rgba(217,119,6,0.3) !important; border-color: rgba(217,119,6,0.7) !important; }
      .xc-card:hover .xc-tg-btn  { background: rgba(0,136,204,0.25) !important; border-color: rgba(0,136,204,0.6) !important; }

      .xc-stat-card, .xc-leader-card, .xc-info-card, .xc-owned-card {
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important;
        cursor: pointer;
      }
      .xc-stat-card:hover, .xc-leader-card:hover, .xc-info-card:hover, .xc-owned-card:hover {
        transform: translateY(-6px) !important;
        box-shadow: 0 16px 40px rgba(217,119,6,0.22) !important;
        border-color: #d97706 !important;
      }
      .xc-stat-card:active, .xc-leader-card:active, .xc-info-card:active, .xc-owned-card:active {
        transform: translateY(-2px) scale(0.99) !important;
        transition: transform 0.08s ease !important;
      }

      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.75; } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

      /* Home page banner: image glides in from the left edge to its resting
         position. Replayed on every image swap (see AutoSlideBanner). */
      @keyframes xcSlideLR {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(0%); }
      }
      .xc-slide-banner-img {
        animation: xcSlideLR 0.9s ease-out;
      }

      .xc-tx-row {
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease !important;
      }
      .xc-tx-row:hover {
        transform: translateY(-3px) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
        border-color: rgba(217,119,6,0.4) !important;
      }
      .xc-tx-row:active {
        transform: translateY(-1px) scale(0.995) !important;
        transition: transform 0.08s ease !important;
      }

      .xc-pay-method {
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease !important;
      }
      .xc-pay-method:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4) !important;
      }
      .xc-pay-method:active {
        transform: translateY(0) scale(0.98) !important;
        transition: transform 0.08s ease !important;
      }

      button, .xc-btn, a.xc-btn {
        transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease !important;
      }
      button:hover:not(:disabled), .xc-btn:hover, a.xc-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 20px rgba(0,0,0,0.35) !important;
        opacity: 0.92 !important;
      }
      button:active:not(:disabled), .xc-btn:active, a.xc-btn:active {
        transform: scale(0.96) translateY(0) !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        opacity: 1 !important;
        transition: transform 0.08s ease, box-shadow 0.08s ease !important;
      }
      button:disabled { cursor: not-allowed !important; opacity: 0.5 !important; }

      a[href][style*="display: block"] {
        transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease !important;
      }
      a[href][style*="display: block"]:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 20px rgba(0,0,0,0.35) !important;
        opacity: 0.92 !important;
      }
      a[href][style*="display: block"]:active {
        transform: scale(0.97) translateY(0) !important;
        transition: transform 0.08s ease !important;
      }

      nav a, nav button {
        transition: color 0.15s ease, opacity 0.15s ease, transform 0.1s ease !important;
      }
      nav a:hover { opacity: 0.75 !important; }
      nav a:active, nav button:active { transform: scale(0.95) !important; }

      .xc-thumb {
        transition: transform 0.2s ease, border-color 0.2s ease !important;
      }
      .xc-thumb:hover {
        transform: scale(1.08) !important;
        border-color: #d97706 !important;
      }
      .xc-thumb:active {
        transform: scale(0.96) !important;
        transition: transform 0.08s ease !important;
      }

      .xc-admin-row {
        transition: background 0.15s ease !important;
      }
      .xc-admin-row:hover {
        background: rgba(217,119,6,0.07) !important;
      }

      .xc-tab {
        transition: background 0.18s ease, color 0.18s ease, transform 0.15s ease !important;
      }
      .xc-tab:hover {
        transform: translateY(-1px) !important;
      }
      .xc-tab:active {
        transform: scale(0.96) !important;
        transition: transform 0.08s ease !important;
      }

      a[href]:not(.xc-btn):not(nav a) {
        transition: opacity 0.15s ease !important;
      }
      a[href]:not(.xc-btn):not(nav a):hover {
        opacity: 0.8 !important;
      }

      /* ===================== RESPONSIVE: TABLET (iPad) & PHONE ===================== */
      html, body { overflow-x: hidden; max-width: 100vw; }
      img { max-width: 100%; }

      @media (max-width: 640px) {
        input, select, textarea { font-size: 16px !important; }
      }

      .xc-table-wrap {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .xc-table-wrap table { min-width: 640px; }

      /* Top navbar → hamburger menu on tablet/phone */
      .xc-nav-hamburger { display: none; }
      .xc-nav-mobile-panel { display: none; }
      @media (max-width: 1024px) {
        .xc-nav-desktop-links { display: none !important; }
        .xc-nav-hamburger { display: flex !important; }
        .xc-nav-mobile-panel.xc-open { display: flex !important; }
      }

      @media (max-width: 1024px) {
        .xc-page-pad { padding-left: 24px !important; padding-right: 24px !important; }
      }
      @media (max-width: 640px) {
        .xc-page-pad { padding-left: 16px !important; padding-right: 16px !important; }
      }

      @media (max-width: 900px) {
        .xc-pd-grid { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(s);
  }
}
