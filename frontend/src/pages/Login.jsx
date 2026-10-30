import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { inputStyle } from '../styles/theme';
import { resolveUserRole, BannedError, LockedOutError } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 5 * 60; // 5 minutes
const STORAGE_KEY = 'masatoshi_login_lockout';

function getLockoutState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { attempts: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch { return { attempts: 0, lockedUntil: 0 }; }
}

function saveLockoutState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function fmtMinutes(seconds) {
  const mins = Math.ceil(seconds / 60);
  return mins <= 1 ? '1 នាទី' : `${mins} នាទី`;
}

export default function Login({ setUserRole, setUserEmail }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(() => getLockoutState().attempts);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  // Restore lockout countdown on mount / tab switch
  useEffect(() => {
    const { lockedUntil, attempts: saved } = getLockoutState();
    setAttempts(saved);
    const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (remaining > 0) startCountdown(remaining);
    return () => clearInterval(timerRef.current);
  }, []);

  const startCountdown = (seconds) => {
    clearInterval(timerRef.current);
    setSecondsLeft(seconds);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Reset attempts after lockout expires
          saveLockoutState({ attempts: 0, lockedUntil: 0 });
          setAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const recordFailure = () => {
    const state = getLockoutState();
    const newAttempts = state.attempts + 1;
    if (newAttempts >= MAX_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
      saveLockoutState({ attempts: newAttempts, lockedUntil });
      setAttempts(newAttempts);
      startCountdown(LOCKOUT_SECONDS);
    } else {
      saveLockoutState({ attempts: newAttempts, lockedUntil: 0 });
      setAttempts(newAttempts);
    }
  };

  const recordSuccess = () => {
    saveLockoutState({ attempts: 0, lockedUntil: 0 });
    setAttempts(0);
    clearInterval(timerRef.current);
    setSecondsLeft(0);
  };

  const isLocked = secondsLeft > 0;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts);

  const applyLogin = (role, email, token) => {
    // Admin rights only count when the server issued a signed token (Google sign-in).
    if (token) { try { localStorage.setItem('authToken', token); } catch {} }
    if (role === 'admin' && !token) {
      alert('Admin access requires "Sign in with Google" (server-verified).');
      role = 'user';
    }
    recordSuccess();
    setUserRole(role);
    setUserEmail(email);
    localStorage.setItem('userRole', role);
    localStorage.setItem('userEmail', email);
    if (role === 'admin') {
      if (window.location.pathname.startsWith('/admin')) navigate('/admin-dashboard');
      else window.location.assign('/admin/');
      return;
    }
    navigate('/');
  };

  const checkUserRole = async (firebaseUser) => {
    const { uid, email } = firebaseUser;

    // Backend is the source of truth for bans — always check it first,
    // regardless of Firestore, so a banned email can't slip through via
    // a leftover Firestore role document.
    const backendRole = await resolveUserRole(email); // throws BannedError/LockedOutError if banned

    if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'users', uid));
        if (docSnap.exists()) { applyLogin(docSnap.data().role || backendRole, email); return; }
      } catch (e) { console.warn('Firestore check failed:', e.message); }
    }
    applyLogin(backendRole, email);
  };

  const handleLogin = async () => {
    if (isLocked) return;
    if (!email || !password) return alert('សូមបញ្ចូល Email និង Password!');
    setLoading(true);
    try {
      // Firebase not configured — use backend role check directly
      if (!auth) {
        const role = await resolveUserRole(email);
        applyLogin(role, email);
        return;
      }
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await checkUserRole(cred.user);
    } catch (error) {
      if (error instanceof LockedOutError) {
        alert(`🚫 ការព្យាយាមច្រើនពេកលើគណនីដែលហាមឃាត់។ សូមព្យាយាមម្តងទៀតក្នុងរយៈពេល ${fmtMinutes(error.secondsLeft)}។`);
        return;
      }
      if (error instanceof BannedError) {
        alert('🚫 គណនីនេះត្រូវបានហាមឃាត់ និងមិនអាចចូលប្រើបានទេ។');
        return;
      }
      if (error.code === 'auth/invalid-api-key' || error.code === 'auth/configuration-not-found') {
        // Firebase keys invalid — fall back to backend role check
        try {
          const role = await resolveUserRole(email);
          applyLogin(role, email);
        } catch (e) {
          if (e instanceof LockedOutError) {
            alert(`🚫 ការព្យាយាមច្រើនពេកលើគណនីដែលហាមឃាត់។ សូមព្យាយាមម្តងទៀតក្នុងរយៈពេល ${fmtMinutes(e.secondsLeft)}។`);
          } else if (e instanceof BannedError) {
            alert('🚫 គណនីនេះត្រូវបានហាមឃាត់ និងមិនអាចចូលប្រើបានទេ។');
          } else {
            applyLogin('user', email);
          }
        }
      } else {
        recordFailure();
        const remaining = MAX_ATTEMPTS - getLockoutState().attempts;
        if (getLockoutState().lockedUntil > Date.now()) {
          alert(`ចូលប្រើប្រាស់បរាជ័យ! គណនីត្រូវបានចាក់សោរ ${Math.ceil(LOCKOUT_SECONDS / 60)} នាទី ដោយសារការព្យាយាមច្រើនពេក។`);
        } else {
          alert(`ចូលប្រើប្រាស់បរាជ័យ! នៅសល់ ${Math.max(0, remaining)} ដង មុននឹងចាក់សោរ។`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (isLocked) return;
    setLoading(true);
    const doLogin = async () => {
      const clientId = window.__GOOGLE_CLIENT_ID__ || '';
      if (!clientId || clientId.includes('REPLACE_WITH')) {
        setLoading(false);
        alert('សូមបន្ថែម Google OAuth Client ID:\n\n1. ទៅ console.cloud.google.com\n2. APIs & Services → Credentials\n3. Copy "Web client" Client ID\n4. បន្ថែមក្នុង index.html:\n   <script>window.__GOOGLE_CLIENT_ID__="YOUR_ID"</script>');
        return;
      }
      if (!window.google?.accounts?.oauth2) {
        alert('Google Sign-In failed to load. Check your internet connection.');
        setLoading(false);
        return;
      }
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: window.__GOOGLE_CLIENT_ID__ || '482813159929-ma2c4blrvtb1oo8a7rdv0jo9v9cqp9o3.apps.googleusercontent.com',
        scope: 'email profile openid',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            setLoading(false);
            if (tokenResponse.error !== 'access_denied') alert('Google login failed: ' + tokenResponse.error);
            return;
          }
          try {
            const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });
            const info = await r.json();
            if (!info.email) throw new Error('No email returned from Google');
            const sr = await fetch('/api/auth/google', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: tokenResponse.access_token }),
            });
            const sd = await sr.json().catch(() => ({}));
            if (sr.status === 403) throw new BannedError(sd.error || 'This account has been banned.');
            if (!sr.ok) throw new Error(sd.error || 'Server login failed');
            applyLogin(sd.role || 'user', sd.email || info.email, sd.token);
          } catch (e) {
            if (e instanceof LockedOutError) {
              alert(`🚫 ការព្យាយាមច្រើនពេកលើគណនីដែលហាមឃាត់។ សូមព្យាយាមម្តងទៀតក្នុងរយៈពេល ${fmtMinutes(e.secondsLeft)}។`);
            } else if (e instanceof BannedError) {
              alert('🚫 គណនីនេះត្រូវបានហាមឃាត់ និងមិនអាចចូលប្រើបានទេ។');
            } else {
              alert('Google login error: ' + e.message);
            }
          } finally { setLoading(false); }
        },
      });
      client.requestAccessToken({ prompt: 'select_account' });
    };

    if (window.google?.accounts?.oauth2) {
      doLogin();
    } else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = doLogin;
      s.onerror = () => { alert('Failed to load Google Sign-In.'); setLoading(false); };
      document.head.appendChild(s);
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.bgDark, padding: '20px' }}>
      <div style={{ background: colors.bgCard, border: `1px solid ${isLocked ? 'rgba(239,68,68,0.4)' : colors.border}`, borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ color: colors.textMain, fontSize: '22px', fontWeight: '800', margin: '0 0 8px 0', textAlign: 'center' }}>{t('login.title')}</h3>

        {/* Lockout banner */}
        {isLocked && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>🔒</div>
            <div style={{ color: '#ef4444', fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
              {t('login.locked')}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '12px', marginBottom: '8px' }}>
              {t('login.failedAttempts', { n: MAX_ATTEMPTS })}
            </div>
            <div style={{ color: '#ef4444', fontSize: '28px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', letterSpacing: '2px' }}>
              {fmt(secondsLeft)}
            </div>
            <div style={{ color: colors.textMuted, fontSize: '11px', marginTop: '4px' }}>
              {t('login.waitForExpiry')}
            </div>
          </div>
        )}

        {/* Attempt warning */}
        {!isLocked && attempts > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>⚠️</span>
            <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: '600' }}>
              {t('login.attemptsLeft', { a: attempts, b: attemptsLeft })}
            </span>
          </div>
        )}

        <input
          type="email"
          placeholder={t('login.emailPlaceholder')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isLocked}
          style={{ ...inputStyle, background: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.textMain, opacity: isLocked ? 0.4 : 1 }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        <input
          type="password"
          placeholder={t('login.passwordPlaceholder')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={isLocked}
          style={{ ...inputStyle, background: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.textMain, opacity: isLocked ? 0.4 : 1 }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        <button
          onClick={handleLogin}
          disabled={loading || isLocked}
          style={{ width: '100%', padding: '12px', background: isLocked ? '#1e293b' : loading ? '#374151' : '#d97706', color: isLocked ? '#475569' : '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: loading || isLocked ? 'not-allowed' : 'pointer' }}
        >
          {isLocked ? `🔒 ${t('login.locked.button')} ${fmt(secondsLeft)}` : loading ? t('login.loggingIn') : t('login.loginButton')}
        </button>

        <button
          onClick={handleGoogleLogin}
          disabled={loading || isLocked}
          style={{ width: '100%', padding: '12px', background: '#2a2420', color: isLocked ? '#475569' : '#fff', border: '1px solid #2d2d44', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: loading || isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isLocked ? 0.4 : 1 }}
        >
          <span style={{ fontSize: '16px' }}>G</span> {t('login.googleLogin')}
        </button>

        <button
          onClick={() => {
            if (!email) return alert('សូមបញ្ចូល Email ជាមុនសិន!');
            if (!auth) return alert('Firebase មិនទាន់កំណត់ — មុខងារភ្លេចពាក្យសម្ងាត់មិនអាចប្រើបាន');
            sendPasswordResetEmail(auth, email).then(() => alert('Reset email sent!')).catch(e => alert(e.message));
          }}
          style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {t('login.forgotPassword')}
        </button>
      </div>
    </div>
  );
}
