import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { navLinkStyle, navTopUpButtonStyle } from '../styles/theme';
import { fetchSettings } from '../services/api';
import Icon from './Icon';
import LangSwitch from './LangSwitch';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ userPoints, handleLogout, isAdmin, userRole, userEmail, pendingUpdates }) {
  const navigate = useNavigate();
  const { t, lang, toggleLang } = useLanguage();
  const { mode, toggleTheme, colors: XCLOUD_THEME } = useTheme();
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef(null);
  const [settings, setSettings] = useState({ siteName: 'Masatoshi', discordUrl: 'https://discord.gg/' });

  useEffect(() => {
    fetchSettings().then(data => { if (data) setSettings(data); }).catch(() => {});
  }, []);

  const count = pendingUpdates?.count ?? 0;
  const items = pendingUpdates?.items ?? [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px clamp(16px, 6vw, 80px)', background: XCLOUD_THEME.bgDark, borderBottom: `1px solid ${XCLOUD_THEME.border}`, transition: 'background-color 0.2s ease, border-color 0.2s ease' }}>
      <Link to="/" style={{ color: XCLOUD_THEME.textMain, fontWeight: '800', textDecoration: 'none', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ background: '#7c5cff', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '14px' }}>MS</span>
        <span style={{ fontSize: '15px', color: XCLOUD_THEME.textMain, fontWeight: '600' }}>{settings.siteName}</span>
      </Link>

      {/* ── Hamburger (tablet & phone only) ── */}
      <button
        className="xc-nav-hamburger"
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Menu"
        style={{
          alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px',
          background: menuOpen ? 'rgba(124,92,255,0.15)' : 'transparent',
          border: `1px solid ${menuOpen ? '#7c5cff' : 'rgba(148,163,184,0.3)'}`,
          borderRadius: '8px', color: XCLOUD_THEME.textMain, fontSize: '18px', cursor: 'pointer',
        }}
      >
        <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
      </button>

      <div className="xc-nav-desktop-links" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <Link to="/" style={{ ...navLinkStyle, color: XCLOUD_THEME.textMuted }}>{t('nav.home')}</Link>
        <Link to="/products" style={{ ...navLinkStyle, color: XCLOUD_THEME.textMuted }}>{t('nav.products')}</Link>
        <a href={settings.discordUrl} target="_blank" rel="noreferrer" style={{ ...navLinkStyle, color: XCLOUD_THEME.textMuted }}>{t('nav.discord')}</a>

        {isAdmin && (
          <>
            <a href="/admin/admin-dashboard" style={{ ...navLinkStyle, color: '#fbbf24' }}>{t('nav.admin')}</a>
            <a href="/admin/admin-upload" style={{ ...navLinkStyle, color: '#10b981' }}> {t('nav.mod')}</a>
          </>
        )}

        <LangSwitch />

        {/* ── Night / normal mode toggle ── */}
        <button
          onClick={toggleTheme}
          title={mode === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark')}
          style={{
            background: 'transparent',
            border: `1px solid rgba(148,163,184,0.3)`,
            color: XCLOUD_THEME.textMuted,
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '15px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          <Icon name={mode === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>

        {userRole !== 'guest' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '700', background: 'rgba(56, 189, 248, 0.08)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              🟢 {userPoints.toLocaleString()} {t('nav.points')}
            </span>
            <button onClick={() => navigate('/topup')} style={{ ...navTopUpButtonStyle, color: mode === 'light' ? '#4338ca' : navTopUpButtonStyle.color }}>{t('nav.topup')}</button>
            <Link to="/report" style={{ ...navTopUpButtonStyle, textDecoration: 'none', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: mode === 'light' ? '#b91c1c' : '#f87171', fontSize: '12px', padding: '6px 12px', borderRadius: '6px' }}>🛠️ {t('nav.report')}</Link>

            {/* ── Notification Bell ── */}
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setBellOpen(o => !o)}
                title={count > 0 ? `${count} ${t('nav.notifications.tooltipCount')}` : t('nav.notifications.tooltipEmpty')}
                style={{
                  position: 'relative',
                  background: bellOpen ? 'rgba(124,92,255,0.15)' : 'transparent',
                  border: `1px solid ${bellOpen ? '#7c5cff' : 'rgba(148,163,184,0.25)'}`,
                  color: count > 0 ? '#fbbf24' : '#94a3b8',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  transition: 'all 0.15s',
                }}
              >
                <Icon name="bell" size={16} />
                {count > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: '700',
                    borderRadius: '50%',
                    minWidth: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    padding: '0 3px',
                    border: '2px solid #07060d',
                  }}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  background: XCLOUD_THEME.bgCard,
                  border: `1px solid ${XCLOUD_THEME.border}`,
                  borderRadius: '10px',
                  minWidth: '280px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  zIndex: 9999,
                  overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${XCLOUD_THEME.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: XCLOUD_THEME.textMain }}>{t('nav.notifications')}</span>
                    {count > 0 && (
                      <span style={{ fontSize: '11px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(251,191,36,0.25)' }}>
                        {count} {t('nav.notifications.new')}
                      </span>
                    )}
                  </div>

                  {/* Items */}
                  {count === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                      {t('nav.notifications.empty')}
                    </div>
                  ) : (
                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                      {items.map((item, i) => (
                        <Link
                          key={item.purchaseId}
                          to={`/mod/${item.productId}`}
                          onClick={() => setBellOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            textDecoration: 'none',
                            borderBottom: i < items.length - 1 ? `1px solid ${XCLOUD_THEME.border}` : 'none',
                            background: 'transparent',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,92,255,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                            🔄
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: XCLOUD_THEME.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '2px' }}>
                              {t('nav.notifications.updated')}
                            </div>
                          </div>
                          <span style={{ color: '#7c5cff', fontSize: '14px' }}>›</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${XCLOUD_THEME.border}`, textAlign: 'center' }}>
                    <Link
                      to="/profile"
                      onClick={() => setBellOpen(false)}
                      style={{ fontSize: '12px', color: '#7c5cff', textDecoration: 'none', fontWeight: '600' }}
                    >
                      {t('nav.notifications.viewAll')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
            {/* ── End Bell ── */}

            <button onClick={() => navigate('/profile')} style={{ background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.3)', color: XCLOUD_THEME.textMuted, padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{userEmail}</button>
            <button onClick={handleLogout} style={{ background: XCLOUD_THEME.accentDanger, color: '#fff', padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{t('nav.logout')}</button>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} style={{ background: '#7c5cff', color: '#fff', padding: '8px 20px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            {t('nav.login')}
          </button>
        )}
      </div>

      {/* ── Mobile / tablet dropdown panel ── */}
      <div
        className={`xc-nav-mobile-panel${menuOpen ? ' xc-open' : ''}`}
        style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          flexDirection: 'column', gap: '4px', padding: '12px 20px 20px',
          background: XCLOUD_THEME.bgDark, borderBottom: `1px solid ${XCLOUD_THEME.border}`,
          boxShadow: '0 16px 40px rgba(0,0,0,0.45)', zIndex: 998,
        }}
      >
        <Link to="/" onClick={() => setMenuOpen(false)} style={{ ...navLinkStyle, color: XCLOUD_THEME.textMuted, padding: '10px 4px' }}>{t('nav.home')}</Link>
        <Link to="/products" onClick={() => setMenuOpen(false)} style={{ ...navLinkStyle, color: XCLOUD_THEME.textMuted, padding: '10px 4px' }}>{t('nav.products')}</Link>
        <a href={settings.discordUrl} target="_blank" rel="noreferrer" style={{ ...navLinkStyle, color: XCLOUD_THEME.textMuted, padding: '10px 4px' }}>{t('nav.discord')}</a>

        {isAdmin && (
          <>
            <a href="/admin/admin-dashboard" onClick={() => setMenuOpen(false)} style={{ ...navLinkStyle, color: '#fbbf24', padding: '10px 4px' }}>{t('nav.admin')}</a>
            <a href="/admin/admin-upload" onClick={() => setMenuOpen(false)} style={{ ...navLinkStyle, color: '#10b981', padding: '10px 4px' }}>{t('nav.mod')}</a>
          </>
        )}

        <div style={{ display: 'flex', gap: '10px', margin: '8px 0' }}>
          <button onClick={toggleLang} style={{ flex: 1, background: 'transparent', border: `1px solid rgba(148,163,184,0.3)`, color: XCLOUD_THEME.textMuted, padding: '9px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            🌐 {lang === 'km' ? 'ខ្មែរ' : 'EN'}
          </button>
          <button onClick={toggleTheme} style={{ flex: 1, background: 'transparent', border: `1px solid rgba(148,163,184,0.3)`, color: XCLOUD_THEME.textMuted, padding: '9px', borderRadius: '6px', fontSize: '15px', cursor: 'pointer' }}>
            {mode === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {userRole !== 'guest' ? (
          <>
            <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '700', background: 'rgba(56, 189, 248, 0.08)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.15)', marginBottom: '8px', textAlign: 'center' }}>
              🟢 {userPoints.toLocaleString()} {t('nav.points')}
            </div>
            <button onClick={() => { navigate('/topup'); setMenuOpen(false); }} style={{ ...navTopUpButtonStyle, width: '100%', padding: '11px', marginBottom: '8px', color: mode === 'light' ? '#4338ca' : navTopUpButtonStyle.color }}>{t('nav.topup')}</button>
            <Link to="/report" onClick={() => setMenuOpen(false)} style={{ ...navTopUpButtonStyle, textDecoration: 'none', display: 'block', textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: mode === 'light' ? '#b91c1c' : '#f87171', fontSize: '12px', padding: '11px', borderRadius: '6px', marginBottom: '8px' }}>🛠️ {t('nav.report')}</Link>
            <button onClick={() => { navigate('/profile'); setMenuOpen(false); }} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(148, 163, 184, 0.3)', color: XCLOUD_THEME.textMuted, padding: '11px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginBottom: '8px' }}>
              👤 {userEmail} {count > 0 ? `(${count > 9 ? '9+' : count} 🔔)` : ''}
            </button>
            <button onClick={() => { handleLogout(); setMenuOpen(false); }} style={{ width: '100%', background: XCLOUD_THEME.accentDanger, color: '#fff', padding: '11px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{t('nav.logout')}</button>
          </>
        ) : (
          <button onClick={() => { navigate('/login'); setMenuOpen(false); }} style={{ background: '#7c5cff', color: '#fff', padding: '11px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            {t('nav.login')}
          </button>
        )}
      </div>
    </nav>
  );
}
