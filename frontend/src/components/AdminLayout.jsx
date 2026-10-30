import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function AdminLayout({ children }) {
  const { mode, toggleTheme, colors } = useTheme();
  const { lang, toggleLang, t } = useLanguage();

  // Admin sidebar navigation links (translated)
  const adminLinks = [
    { to: '/admin-dashboard', label: t('admin.dashboard') },
    { to: '/admin-upload',    label: t('admin.uploadMod') },
    { to: '/admin-upload-history', label: t('admin.uploadHistory') },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: colors.bgDark }}>
      <aside style={{ width: 220, background: mode === 'dark' ? '#0a0a10' : colors.bgCard, borderRight: `1px solid ${colors.border}`, padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>⚙️ {t('admin.panel')}</div>

        {adminLinks.map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={{ color: colors.textMuted, textDecoration: 'none', fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 8, display: 'block' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(217,119,6,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {link.label}
          </Link>
        ))}

        {/* Theme + language toggles */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24, borderTop: `1px solid ${colors.border}` }}>
          <button
            onClick={toggleLang}
            title={t('nav.langSwitch')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.textMain,
              fontSize: 12, fontWeight: 700, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
            }}
          >
            🌐 {lang === 'km' ? 'ខ្មែរ / EN' : 'EN / ខ្មែរ'}
          </button>

          <button
            onClick={toggleTheme}
            title={mode === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.textMain,
              fontSize: 12, fontWeight: 700, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
            }}
          >
            {mode === 'dark' ? '☀️' : '🌙'} {mode === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark')}
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, color: colors.textMain }}>{children}</main>
    </div>
  );
}
