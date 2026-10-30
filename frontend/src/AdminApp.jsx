import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';

import { injectGlobalStyles } from './styles/theme';
import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';

import Login from './pages/Login';
import Dashboard from './admin/Dashboard';
import Upload from './admin/Upload';
import AdminProducts from './admin/Products';
import Users from './admin/Users';
import Orders from './admin/Orders';
import Topups from './admin/Topups';
import Settings from './admin/Settings';
import Reports from './admin/Reports';

injectGlobalStyles();

function getNavLinks(t) {
  return [
    { to: '/admin-dashboard', label: `📊 ${t('admin.dashboard').replace('📊 ', '')}` },
    { to: '/admin-upload',    label: `📦 ${t('admin.uploadMod').replace('📦 ', '')}` },
    { to: '/admin-products',  label: '🛒 Products' },
    { to: '/admin-users',     label: '👥 Users' },
    { to: '/admin-orders',    label: '📋 Orders' },
    { to: '/admin-topups',    label: '💰 Topups' },
    { to: '/admin-reports',   label: '🛠️ Reports' },
    { to: '/admin-settings',  label: '⚙️ Settings' },
  ];
}

// 404 page shown to non-admins who try to access admin panel
function NotFound404() {
  const { colors } = useTheme();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: colors.bgDark, flexDirection: 'column', gap: '12px',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ fontSize: '72px', lineHeight: 1, color: colors.textMain }}>404</div>
      <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '22px' }}>Page Not Found</div>
      <div style={{ color: colors.textMuted, fontSize: '14px', maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
        The page you are looking for does not exist or you do not have permission to view it.
      </div>
      <div style={{ color: colors.textMuted, fontSize: '12px', marginTop: '8px' }}>HTTP 404 · masatoshi.admin</div>
    </div>
  );
}

function Sidebar({ userEmail, onLogout }) {
  const { mode, toggleTheme, colors } = useTheme();
  const { lang, toggleLang, t } = useLanguage();
  const navLinks = getNavLinks(t);

  return (
    <aside style={{
      width: '220px', minHeight: '100vh', background: mode === 'dark' ? '#100e0c' : colors.bgCard,
      borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column',
      padding: '24px 12px', gap: '4px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '16px', padding: '0 10px', marginBottom: '24px' }}>
        ⚙ Masatoshi<br />
        <span style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 400 }}>{t('admin.panel')}</span>
      </div>

      {navLinks.map(link => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            display: 'block', padding: '10px 14px', borderRadius: '8px', textDecoration: 'none',
            fontSize: '13px', fontWeight: 600,
            color: isActive ? colors.textMain : colors.textMuted,
            background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
            borderLeft: isActive ? '3px solid #f59e0b' : '3px solid transparent',
            transition: 'all 0.15s',
          })}
        >
          {link.label}
        </NavLink>
      ))}

      {/* Theme + language toggles */}
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={toggleLang}
          title={t('nav.langSwitch')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '9px', background: colors.bgInput, border: `1px solid ${colors.border}`,
            borderRadius: '6px', color: colors.textMain, cursor: 'pointer', fontSize: '12px', fontWeight: 700,
          }}
        >
          🌐 {lang === 'km' ? 'ខ្មែរ / EN' : 'EN / ខ្មែរ'}
        </button>
        <button
          onClick={toggleTheme}
          title={mode === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '9px', background: colors.bgInput, border: `1px solid ${colors.border}`,
            borderRadius: '6px', color: colors.textMain, cursor: 'pointer', fontSize: '12px', fontWeight: 700,
          }}
        >
          {mode === 'dark' ? '☀️' : '🌙'} {mode === 'dark' ? t('nav.themeToLight') : t('nav.themeToDark')}
        </button>
      </div>

      <div style={{ marginTop: 'auto', borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
        <div style={{ color: colors.textMuted, fontSize: '11px', padding: '0 10px', marginBottom: '10px', wordBreak: 'break-all' }}>
          {userEmail}
        </div>
        <button
          onClick={onLogout}
          style={{ width: '100%', padding: '9px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: '6px', color: colors.textMuted, cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
        >
          🚪 {t('nav.logout')}
        </button>
      </div>
    </aside>
  );
}

export default function AdminApp() {
  const [products, setProducts] = useState([]);
  const [userRole, setUserRole] = useState(() => {
    try { return localStorage.getItem('userRole') || 'guest'; } catch { return 'guest'; }
  });
  const [userEmail, setUserEmail] = useState(() => {
    try { return localStorage.getItem('userEmail') || ''; } catch { return ''; }
  });
  const [pendingDeposits, setPendingDeposits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pendingDeposits') || '[]'); } catch { return []; }
  });
  const [transactions, setTransactions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('transactions') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    axios.get('/api/products')
      .then(res => { if (Array.isArray(res.data)) setProducts(res.data); })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    setUserRole('guest');
    setUserEmail('');
    try {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('authToken');
    } catch {}
  };

  const isAdmin = userRole === 'admin';
  // guest = not logged in yet, show login
  // logged in but not admin = show 404
  const isGuest = userRole === 'guest';

  const sharedAdminProps = {
    products, setProducts,
    pendingDeposits, setPendingDeposits,
    setUserPoints: () => {},
    setTransactions,
    loggedInEmail: userEmail,
  };

  // Not logged in → show Login page
  if (isGuest) {
    return (
      <Router basename="/admin">
        <Routes>
          <Route path="*" element={<Login setUserRole={setUserRole} setUserEmail={setUserEmail} />} />
        </Routes>
      </Router>
    );
  }

  // Logged in but NOT admin → show 404 (looks like the page doesn't exist)
  if (!isAdmin) {
    return (
      <Router basename="/admin">
        <Routes>
          <Route path="*" element={<NotFound404 />} />
        </Routes>
      </Router>
    );
  }

  // Admin → full panel
  return (
    <Router basename="/admin">
      <AdminShell userEmail={userEmail} handleLogout={handleLogout} sharedAdminProps={sharedAdminProps} products={products} setProducts={setProducts} />
    </Router>
  );
}

// Split out so it can call useTheme()/useLanguage() (must be inside the providers set up in main.admin.jsx)
function AdminShell({ userEmail, handleLogout, sharedAdminProps, products, setProducts }) {
  const { colors } = useTheme();
  return (
      <div style={{ display: 'flex', backgroundColor: colors.bgDark, color: colors.textMain, fontFamily: 'sans-serif', minHeight: '100vh' }}>
        <Sidebar userEmail={userEmail} onLogout={handleLogout} />
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/"                element={<Navigate to="/admin-dashboard" replace />} />
            <Route path="/login"           element={<Navigate to="/admin-dashboard" replace />} />
            <Route path="/admin-dashboard" element={<Dashboard {...sharedAdminProps} />} />
            <Route path="/admin-upload"    element={<Upload products={products} setProducts={setProducts} />} />
            <Route path="/admin-products"  element={<AdminProducts products={products} setProducts={setProducts} />} />
            <Route path="/admin-users"     element={<Users />} />
            <Route path="/admin-orders"    element={<Orders />} />
            <Route path="/admin-topups"    element={<Topups {...sharedAdminProps} />} />
            <Route path="/admin-reports"   element={<Reports />} />
            <Route path="/admin-settings"  element={<Settings />} />
            <Route path="*"               element={<Navigate to="/admin-dashboard" replace />} />
          </Routes>
        </main>
      </div>
  );
}
