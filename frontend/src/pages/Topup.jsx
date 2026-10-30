import React, { useState, useEffect, useRef } from 'react';
import { inputStyle, labelStyle } from '../styles/theme';
import { uploadSlipToCloudinary, submitDeposit, fetchSettings, generateBakongQR, checkBakongStatus } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function Topup({ userEmail, pendingDeposits, setPendingDeposits, setTransactions, userPoints, setUserPoints }) {
  const { colors: XCLOUD_THEME } = useTheme();
  const { t } = useLanguage();
  const [activeMethod, setActiveMethod] = useState('bakong_auto');
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pointRate, setPointRate] = useState(100);

  useEffect(() => {
    const loadPointRate = () => {
      fetchSettings()
        .then(data => { if (data && data.pointRate > 0) setPointRate(data.pointRate); })
        .catch(() => {});
    };
    loadPointRate();
    const interval = setInterval(loadPointRate, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Bakong instant auto-pay state ──────────────────────────
  const [bkPoints, setBkPoints] = useState('');
  const [bkCurrency, setBkCurrency] = useState('KHR');
  const [bkStage, setBkStage] = useState('form'); // form | generating | waiting | refreshing | success | expired | error
  const [bkError, setBkError] = useState('');
  const [bkQr, setBkQr] = useState(null); // { depositId, qrImage, amount, currency, points, expiresAt }
  const [bkSecondsLeft, setBkSecondsLeft] = useState(0);
  const [bkNotice, setBkNotice] = useState(''); // non-blocking heads-up while still waiting, e.g. verification is delayed
  const bkPollRef = useRef(null);
  const bkCountdownRef = useRef(null);
  const bkRefreshTimeoutRef = useRef(null);

  const clearBkTimers = () => {
    if (bkPollRef.current) clearInterval(bkPollRef.current);
    if (bkCountdownRef.current) clearInterval(bkCountdownRef.current);
    if (bkRefreshTimeoutRef.current) clearTimeout(bkRefreshTimeoutRef.current);
    bkPollRef.current = null;
    bkCountdownRef.current = null;
    bkRefreshTimeoutRef.current = null;
  };

  useEffect(() => clearBkTimers, []); // cleanup on unmount

  // ── Persistence so a real payment is never lost to a backgrounded/reloaded tab ──
  // Mobile flow is: generate QR here, then switch away to the Bakong app to pay.
  // Browsers often throttle or fully reload backgrounded tabs, which would wipe
  // all this component's state mid-payment. We stash the active deposit in
  // localStorage so that when the page is opened again — same tab resumed, or a
  // fresh reload — we pick the payment back up instead of just showing the form.
  const bkStorageKey = userEmail ? `bakong_active_${userEmail}` : null;
  const saveActiveBk = (data) => {
    if (!bkStorageKey) return;
    try { localStorage.setItem(bkStorageKey, JSON.stringify(data)); } catch {}
  };
  const clearActiveBk = () => {
    if (!bkStorageKey) return;
    try { localStorage.removeItem(bkStorageKey); } catch {}
  };

  // Guards against the client-side countdown and the server poll both trying
  // to trigger a refresh for the same expired QR at (almost) the same time.
  const bkRefreshingGuardRef = useRef(false);

  // Unlimited auto-refresh: whenever a QR is discovered to be expired — whether
  // the client's own countdown hit 0, or the server poll confirmed it — clear
  // everything, show a brief "refreshing" flash, and generate a brand new QR
  // with a fresh 5-minute countdown for the SAME points/currency. This keeps
  // looping with no cap, forever, until the user pays or leaves the page.
  const triggerExpiredRefresh = (pts, currency) => {
    if (bkRefreshingGuardRef.current) return; // already refreshing — don't double-fire
    bkRefreshingGuardRef.current = true;
    clearBkTimers();
    clearActiveBk();
    setBkStage('refreshing');
    bkRefreshTimeoutRef.current = setTimeout(() => {
      bkRefreshingGuardRef.current = false;
      startBakongFlow(pts, currency, true);
    }, 1500);
  };

  // Starts/resumes the countdown + status polling for an already-generated QR.
  const attachPolling = (data) => {
    setBkQr(data);
    setBkStage('waiting');

    const msLeft = data.expiresAt - Date.now();
    setBkSecondsLeft(Math.max(0, Math.floor(msLeft / 1000)));

    clearBkTimers();

    // Countdown timer — this is the SOURCE OF TRUTH for expiry on the client.
    // It no longer just freezes at 0: the instant it hits 0 it immediately
    // kicks off a fresh QR itself, instead of waiting on the next server poll
    // (which could be delayed, or silently failing over a flaky connection).
    bkCountdownRef.current = setInterval(() => {
      setBkSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(bkCountdownRef.current);
          triggerExpiredRefresh(data.points, data.currency);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Poll payment status every 3s. Note: points are actually credited
    // server-side (either by this poll or by the backend's own independent
    // background poller) — this loop is just what makes the popup appear
    // promptly while the user has the page open.
    bkPollRef.current = setInterval(async () => {
      try {
        const statusData = await checkBakongStatus(data.depositId);
        if (statusData.status === 'approved') {
          clearBkTimers();
          clearActiveBk();
          setBkStage('success');
          setBkNotice('');
          if (typeof setUserPoints === 'function') {
            setUserPoints(prev => prev + (statusData.points || data.points));
          }
          if (typeof setTransactions === 'function') {
            setTransactions(prev => [{
              id: data.depositId,
              user: userEmail,
              method: 'Bakong KHQR',
              amount: data.amount,
              currency: data.currency,
              points: data.points,
              pointRateUsed: data.pointRateUsed,
              timestamp: new Date().toISOString(),
              status: 'approved',
              type: 'topup',
            }, ...prev]);
          }
        } else if (statusData.status === 'rejected') {
          // Bakong gave a definitive "this payment did not go through" signal
          // (declined/invalid/cancelled) — this is different from simply not
          // having paid yet, so stop polling and show a clear failure popup
          // instead of leaving the user staring at a QR that will never work.
          clearBkTimers();
          clearActiveBk();
          setBkStage('failed');
        } else if (statusData.status === 'expired') {
          // QR lifetime is up and it was never paid — auto-generate a fresh
          // QR for the same points/currency instead of making the user click
          // a button. Brief "refreshing" flash so it's clear what happened.
          triggerExpiredRefresh(data.points, data.currency);
        } else {
          // Still pending. Surface a gentle heads-up if the backend has been
          // unable to verify with Bakong for a while — this is different from
          // "customer hasn't paid yet" and the user shouldn't be left guessing.
          setBkNotice(statusData.notice === 'verification_delayed' ? 'delayed' : '');
        }
      } catch (e) {
        // transient network hiccup — keep polling, don't blow up the UI
        console.error('Bakong poll error:', e);
      }
    }, 3000);
  };

  // Core flow: generate a QR for (pts, currency) and start polling it.
  // Takes explicit args (rather than reading bkPoints/bkCurrency state) so that
  // an auto-refresh after expiry always regenerates the SAME order, even though
  // it's triggered from inside a timer closure.
  const startBakongFlow = async (pts, currency, isAutoRefresh = false) => {
    setBkError('');
    setBkNotice('');
    setBkStage('generating');
    try {
      const data = await generateBakongQR({ userEmail, points: pts, currency });
      saveActiveBk(data);
      attachPolling(data);
    } catch (e) {
      if (isAutoRefresh) {
        // Part of the unlimited auto-refresh loop — a transient hiccup here
        // (network blip, brief server error, etc.) must NOT strand the user
        // on a dead "click to retry" screen. Show what happened, then keep
        // trying again automatically, forever, until it succeeds or the user
        // pays / leaves. Retry a little slower than the happy-path refresh to
        // avoid hammering the server if something is persistently wrong.
        setBkStage('refreshing');
        setBkNotice('retry_error');
        bkRefreshTimeoutRef.current = setTimeout(() => {
          bkRefreshingGuardRef.current = false;
          startBakongFlow(pts, currency, true);
        }, 4000);
      } else {
        setBkStage('error');
        setBkError(e.message || 'Failed to generate QR');
      }
    }
  };

  // On mount (including after the tab was reloaded mid-payment), check for a
  // saved in-flight deposit and pick it back up — either showing the success
  // popup right away (if it was confirmed while we were away) or resuming polling.
  useEffect(() => {
    if (!bkStorageKey) return;
    let saved;
    try { saved = JSON.parse(localStorage.getItem(bkStorageKey) || 'null'); } catch { saved = null; }
    if (!saved || !saved.depositId) return;

    (async () => {
      try {
        const statusData = await checkBakongStatus(saved.depositId);
        if (statusData.status === 'approved') {
          clearActiveBk();
          setBkQr(saved);
          setBkStage('success');
          // Don't add to userPoints here — a fresh page load already fetches
          // the user's current point total from the server, which by now
          // already reflects this credit. This just shows the confirmation.
        } else if (statusData.status === 'rejected') {
          clearActiveBk();
          setBkQr(saved);
          setBkStage('failed');
        } else if (statusData.status === 'pending' && saved.expiresAt > Date.now()) {
          attachPolling(saved);
        } else {
          // Expired or rejected while we were away — clear it, but don't
          // silently pop a brand-new QR without the user asking this time.
          clearActiveBk();
        }
      } catch (e) {
        console.error('Bakong resume-check error:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bkStorageKey]);

  const handleGenerateBakongQR = () => {
    const pts = parseInt(bkPoints, 10);
    if (!pts || pts <= 0) { setBkError('សូមបញ្ចូលចំនួនពិន្ទុឱ្យបានត្រឹមត្រូវ'); return; }
    startBakongFlow(pts, bkCurrency);
  };

  const resetBakongFlow = () => {
    clearBkTimers();
    bkRefreshingGuardRef.current = false;
    clearActiveBk();
    setBkStage('form');
    setBkQr(null);
    setBkError('');
    setBkNotice('');
    setBkPoints('');
  };

  const bkAmountPreview = bkPoints > 0
    ? (bkCurrency === 'USD'
        ? null // computed server-side from live exchange rate; avoid showing a wrong client estimate
        : Math.round(parseInt(bkPoints, 10) * pointRate))
    : null;

  const paymentGateways = {
    bakong_auto: {
      title: 'BAKONG KHQR (Auto)',
      accountName: 'THENG SEANGHENG',
      accountNumber: t('topup.bakongScanPayReceive'),
      logo: '/img/qr-center-logo.png',
    },
    abapay: {
      title: 'ABA PAYWAY',
      accountName: 'THENG SEANGHENG',
      accountNumber: `${t('topup.scanToPay')} (ABA Mobile / Bakong)`,
      paywayUrl: 'https://link.payway.com.kh/ABAPAYk7461477Z',
      qrUrl: '/img/aba_qr.jpg',
      logo: '/img/logo_aba.png',
    },
    bakong: {
      title: 'WING BANK QR',
      accountName: 'THENG SEANGHENG',
      accountNumber: `${t('topup.scanToPay')} (Wing Bank App)`,
      paywayUrl: null,
      qrUrl: '/img/wing_qr.jpg',
      logo: '/img/logo_wing.png',
    },
  };

  const currentGateway = paymentGateways[activeMethod];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setSlipFile(file); setSlipPreview(URL.createObjectURL(file)); }
  };

  const handleSubmitDepositForm = async (e) => {
    e.preventDefault();
    if (!slipFile) return alert('សូមអាប់ឡូដរូបភាពវិក្កយបត្រ (Slip) ផ្ទេរប្រាក់ជាមុនសិន មុននឹងបញ្ជាក់ព័ត៌មាន!');
    if (!amountPaid || parseFloat(amountPaid) <= 0) return alert('សូមបញ្ជាក់ចំនួនទឹកប្រាក់ដែលបានផ្ទេរឱ្យបានត្រឹមត្រូវ!');

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const slipUrl = await uploadSlipToCloudinary(slipFile, setUploadProgress);

      const backendRes = await submitDeposit({
        userEmail,
        method: currentGateway.title,
        amount: parseFloat(amountPaid),
        slipUrl,
      });

      if (!backendRes.ok) {
        let errMsg = 'Server error';
        try { errMsg = (await backendRes.json()).error || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }

      const { deposit: savedDeposit } = await backendRes.json();

      const depositPayload = {
        id: savedDeposit.depositId,
        user: savedDeposit.userEmail,
        method: savedDeposit.method,
        amount: savedDeposit.amount,
        currency: 'KHR',
        slipUrl: savedDeposit.slipUrl,
        timestamp: savedDeposit.timestamp,
        status: 'pending',
      };

      setPendingDeposits(prev => [depositPayload, ...prev]);
      setTransactions(prev => [{ ...depositPayload, type: 'topup' }, ...prev]);

      setSlipFile(null);
      setSlipPreview(null);
      setAmountPaid('');
      alert('បានបញ្ជូនព័ត៌មានបញ្ចូលប្រាក់ដោយជោគជ័យ! សូមរង់ចាំការអនុម័ត។');
    } catch (err) {
      alert('ការបញ្ជូនបរាជ័យ: ' + err.message);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <>
    <div className="xc-page-pad" style={{ background: XCLOUD_THEME.bgDark, color: XCLOUD_THEME.textMain, padding: '20px 20px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '24px' }}>{t('topup.title')}</h2>

        {/* Payment method selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          {Object.entries(paymentGateways).map(([key, gw]) => (
            <div
              key={key}
              className="xc-pay-method"
              onClick={() => setActiveMethod(key)}
              style={{ flex: '1 1 140px', background: activeMethod === key ? 'rgba(124,92,255,0.15)' : XCLOUD_THEME.bgCard, border: `1px solid ${activeMethod === key ? '#7c5cff' : XCLOUD_THEME.border}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '6px', border: activeMethod === key ? '2px solid #7c5cff' : '1px solid rgba(0,0,0,0.06)', boxSizing: 'border-box', overflow: 'hidden' }}>
                <img src={gw.logo} alt={gw.title} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} onError={e => { e.target.style.display = 'none'; e.target.parentElement.textContent = key === 'bakong_auto' ? '⚡' : key === 'abapay' ? '🏦' : '🏧'; }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: XCLOUD_THEME.textMain }}>{gw.title}</div>
                <div style={{ fontSize: 12, color: XCLOUD_THEME.textMuted }}>{gw.accountNumber}</div>
              </div>
            </div>
          ))}
        </div>

        {activeMethod === 'bakong_auto' ? (
          <div style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '16px', padding: '28px' }}>

            {bkStage === 'form' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 8px', background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <img src="/img/qr-center-logo.png" alt="Bakong" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: XCLOUD_THEME.textMain }}>{t('topup.bakongAutoTitle')}</div>
                  <div style={{ fontSize: 12, color: XCLOUD_THEME.textMuted, marginTop: 4 }}>{t('topup.bakongAutoSubtitle')}</div>
                </div>

                <div>
                  <label style={{ ...labelStyle, color: XCLOUD_THEME.textMuted }}>{t('topup.currency')}</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: 6 }}>
                    {['KHR', 'USD'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBkCurrency(c)}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                          border: `1px solid ${bkCurrency === c ? '#7c5cff' : XCLOUD_THEME.border}`,
                          background: bkCurrency === c ? 'rgba(124,92,255,0.15)' : XCLOUD_THEME.bgDark,
                          color: XCLOUD_THEME.textMain,
                        }}
                      >
                        {c === 'KHR' ? t('topup.currencyKHR') : t('topup.currencyUSD')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ ...labelStyle, color: XCLOUD_THEME.textMuted }}>{t('topup.pointsToTopUp')}</label>
                  <input
                    type="number"
                    min="1"
                    placeholder={t('topup.pointsPlaceholder')}
                    value={bkPoints}
                    onChange={e => setBkPoints(e.target.value)}
                    style={{ ...inputStyle, background: XCLOUD_THEME.bgInput, border: `1px solid ${XCLOUD_THEME.border}`, color: XCLOUD_THEME.textMain }}
                  />
                  {bkCurrency === 'KHR' && bkAmountPreview !== null && (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#38bdf8', fontWeight: '600' }}>
                      {t('topup.mustPay')} {bkAmountPreview.toLocaleString()} ៛
                      <span style={{ color: XCLOUD_THEME.textMuted, fontWeight: '400', fontSize: '11px' }}> ({t('topup.rate')}: {pointRate.toLocaleString()} ៛ / {t('topup.points')})</span>
                    </div>
                  )}
                  {bkCurrency === 'USD' && bkPoints > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: XCLOUD_THEME.textMuted }}>
                      {t('topup.usdPriceNotice')}
                    </div>
                  )}
                </div>

                {bkError && (
                  <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '12px', color: '#fca5a5', fontSize: '13px' }}>
                    ❌ {bkError}
                  </div>
                )}

                <button
                  onClick={handleGenerateBakongQR}
                  disabled={bkStage === 'generating'}
                  style={{ width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '700', color: '#fff', background: XCLOUD_THEME.accentPurple, cursor: 'pointer' }}
                >
                  {t('topup.generateQrInstant')}
                </button>
              </div>
            )}

            {bkStage === 'generating' && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: XCLOUD_THEME.textMuted }}>⏳ កំពុងបង្កើត QR...</div>
            )}

            {bkStage === 'waiting' && bkQr && (
              <div style={{ textAlign: 'center' }}>
                {/* KHQR-style payment card */}
                <div style={{ maxWidth: 320, margin: '0 auto', borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}>
                  {/* Red header with wave cut, KHQR wordmark */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ background: 'linear-gradient(135deg,#ED1C24 0%,#C8102E 100%)', padding: '22px 24px 42px', textAlign: 'center' }}>
                      <img src="/img/khqr-header-logo.png" alt="KHQR" style={{ height: 30, display: 'inline-block' }} />
                    </div>
                    <svg viewBox="0 0 400 50" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 34, display: 'block' }}>
                      <path d="M0,14 C90,50 150,4 230,26 C300,44 350,18 400,0 L400,50 L0,50 Z" fill="#ffffff" />
                    </svg>
                  </div>

                  {/* White body: recipient, amount, dashed rule, QR */}
                  <div style={{ background: '#ffffff', padding: '4px 24px 26px' }}>
                    <div style={{ textAlign: 'left', fontSize: 13, color: '#6b7280', fontWeight: 600 }}>
                      {currentGateway.accountName}
                    </div>
                    <div style={{ textAlign: 'left', marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 30, fontWeight: 800, color: '#111827' }}>
                        {bkQr.currency === 'USD' ? `$${bkQr.amount.toFixed(2)}` : bkQr.amount.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#6b7280' }}>{bkQr.currency}</span>
                    </div>

                    <div style={{ borderTop: '2px dashed #e5e7eb', margin: '18px 0' }} />

                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={bkQr.qrImage} alt="Bakong KHQR" style={{ width: 220, height: 220, display: 'block' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff' }}>
                        <img src="/img/qr-center-logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: XCLOUD_THEME.textMuted, margin: '16px 0 12px' }}>
                  = {bkQr.points} ពិន្ទុ — ស្កេនតាមកម្មវិធី Bakong ដើម្បីបង់ប្រាក់
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: '#38bdf8', fontWeight: 600 }}>
                  <span className="xc-spin" style={{ display: 'inline-block' }}>⏳</span>
                  កំពុងរង់ចាំការបង់ប្រាក់... ({Math.floor(bkSecondsLeft / 60)}:{String(bkSecondsLeft % 60).padStart(2, '0')})
                </div>
                {bkNotice === 'delayed' && (
                  <div style={{ marginTop: 14, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#a78bfa', textAlign: 'left' }}>
                    ⚠️ ការផ្ទៀងផ្ទាត់ការបង់ប្រាក់កំពុងចាប់ពេលយូរជាងធម្មតា។ ប្រសិនបើអ្នកបានបង់ប្រាក់រួច សូមរង់ចាំបន្តិច ឬទាក់ទងផ្នែកជំនួយ។
                  </div>
                )}
                <div style={{ marginTop: 20 }}>
                  <button onClick={resetBakongFlow} style={{ background: 'none', border: 'none', color: XCLOUD_THEME.textMuted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                    បោះបង់ / ចាប់ផ្តើមម្តងទៀត
                  </button>
                </div>
              </div>
            )}

            {bkStage === 'success' && bkQr && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#10b981' }}>ទូទាត់បានជោគជ័យ</div>
                <div style={{ fontSize: 14, color: XCLOUD_THEME.textMain, marginTop: 6 }}>
                  អ្នកទទួលបាន <strong>{bkQr.points} ពិន្ទុ</strong> ដោយស្វ័យប្រវត្តិ
                </div>
              </div>
            )}

            {bkStage === 'refreshing' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>⌛</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#a78bfa' }}>
                  {bkNotice === 'retry_error' ? 'មានបញ្ហាបណ្តោះអាសន្នក្នុងការបង្កើត QR' : 'QR បានផុតកំណត់ពេល — មិនទាន់បង់ប្រាក់'}
                </div>
                <div style={{ fontSize: 13, color: XCLOUD_THEME.textMuted, marginTop: 4 }}>
                  <span className="xc-spin" style={{ display: 'inline-block', marginRight: 6 }}>⏳</span>
                  កំពុងបង្កើត QR ថ្មីដោយស្វ័យប្រវត្តិ...
                </div>
              </div>
            )}

            {bkStage === 'failed' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>❌</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#f87171' }}>ការទូទាត់ប្រាក់បរាជ័យ</div>
                <div style={{ fontSize: 13, color: XCLOUD_THEME.textMuted, marginTop: 6 }}>
                  Bakong បានបដិសេធការទូទាត់នេះ។ សូមព្យាយាមស្កេនម្តងទៀត។
                </div>
                <button onClick={resetBakongFlow} style={{ marginTop: 16, padding: '10px 24px', background: XCLOUD_THEME.accentPurple, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  ព្យាយាមម្តងទៀត
                </button>
              </div>
            )}

            {bkStage === 'error' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>❌</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#f87171' }}>{bkError || 'មានបញ្ហាកើតឡើង'}</div>
                <button onClick={resetBakongFlow} style={{ marginTop: 16, padding: '10px 24px', background: XCLOUD_THEME.accentPurple, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  ព្យាយាមម្តងទៀត
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* QR code (manual methods) */}
            <div style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '16px', padding: '24px', marginBottom: '20px', textAlign: 'center' }}>
              <img src={currentGateway.qrUrl} alt="QR Code" style={{ width: 260, height: 'auto', borderRadius: 12, border: '4px solid #fff', margin: '0 auto 16px auto', display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: 16, color: XCLOUD_THEME.textMain, marginBottom: 4 }}>{currentGateway.accountName}</div>
              <div style={{ fontSize: 12, color: XCLOUD_THEME.textMuted }}>{currentGateway.accountNumber}</div>
              {currentGateway.paywayUrl && (
                <a href={currentGateway.paywayUrl} target="_blank" rel="noreferrer" className="xc-btn" style={{ display: 'inline-block', marginTop: 12, padding: '10px 24px', background: '#7c5cff', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                  {t('topup.openPayway')}
                </a>
              )}
            </div>

            {/* Submission form (manual methods) */}
            <form onSubmit={handleSubmitDepositForm} style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ ...labelStyle, color: XCLOUD_THEME.textMuted, marginBottom: '8px' }}>{t('topup.uploadSlip')}</label>
                <div style={{ position: 'relative', border: '2px dashed #1e1e2e', borderRadius: '12px', padding: '30px 20px', textAlign: 'center', background: XCLOUD_THEME.bgDark, cursor: 'pointer' }}>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                  {slipPreview ? (
                    <div>
                      <img src={slipPreview} alt="slip preview" style={{ height: '90px', borderRadius: '6px' }} />
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#10b981' }}>✓ {slipFile?.name}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: XCLOUD_THEME.textMain }}>{t('topup.clickToUpload')}</div>
                  )}
                </div>
                {isSubmitting && uploadProgress > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ background: '#241f3a', borderRadius: '4px', overflow: 'hidden', height: '6px' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#7c5cff', transition: 'width 0.2s' }} />
                    </div>
                    <div style={{ fontSize: '11px', color: XCLOUD_THEME.textMuted, marginTop: '4px' }}>
                      {uploadProgress < 100 ? `${t('topup.uploading')} ${uploadProgress}%` : t('topup.done')}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label style={{ ...labelStyle, color: XCLOUD_THEME.textMuted }}>{t('topup.confirmAmount')}</label>
                <input type="number" placeholder={t('topup.amountPlaceholder')} value={amountPaid} onChange={e => setAmountPaid(e.target.value)} style={{ ...inputStyle, background: XCLOUD_THEME.bgInput, border: `1px solid ${XCLOUD_THEME.border}`, color: XCLOUD_THEME.textMain }} required />
                {amountPaid > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#38bdf8', fontWeight: '600' }}>
                    ≈ {Math.floor(parseFloat(amountPaid) / pointRate)} {t('topup.points')}
                    <span style={{ color: XCLOUD_THEME.textMuted, fontWeight: '400', fontSize: '11px' }}> ({t('topup.rate')}: {pointRate.toLocaleString()} ៛ / {t('topup.points')})</span>
                  </div>
                )}
              </div>
              <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '700', color: '#fff', background: isSubmitting ? '#374151' : XCLOUD_THEME.accentPurple, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                {isSubmitting ? (uploadProgress < 100 ? `${t('topup.uploadingSlip')} ${uploadProgress}%` : t('topup.savingInfo')) : t('topup.confirmInfo')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>

    {/* ── Real full-screen success popup — pops up the moment Bakong confirms payment ── */}
    {bkStage === 'success' && bkQr && (
      <>
        <div onClick={resetBakongFlow} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 1001, background: '#100d1c', border: '1px solid rgba(16,185,129,0.4)',
          borderRadius: 16, padding: '32px 28px', width: '90%', maxWidth: 360,
          textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: '#10b981' }}>ទូទាត់បានជោគជ័យ</div>
          <div style={{ fontSize: 14, color: XCLOUD_THEME.textMain, marginTop: 10 }}>
            អ្នកទទួលបាន <strong>{bkQr.points} ពិន្ទុ</strong> ដោយស្វ័យប្រវត្តិ
          </div>
          <div style={{ fontSize: 12, color: XCLOUD_THEME.textMuted, marginTop: 4 }}>
            {bkQr.currency === 'USD' ? `$${bkQr.amount.toFixed(2)}` : `${bkQr.amount.toLocaleString()} ៛`} — មិនចាំបាច់រង់ចាំការអនុញ្ញាតពីអ្នកគ្រប់គ្រង
          </div>
          <button onClick={resetBakongFlow} style={{ marginTop: 22, padding: '10px 28px', background: XCLOUD_THEME.accentPurple, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            យល់ព្រម
          </button>
        </div>
      </>
    )}

    {/* ── Real full-screen failure popup — pops up the moment Bakong reports a definitive payment failure ── */}
    {bkStage === 'failed' && (
      <>
        <div onClick={resetBakongFlow} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 1001, background: '#100d1c', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 16, padding: '32px 28px', width: '90%', maxWidth: 360,
          textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>❌</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: '#f87171' }}>ការទូទាត់ប្រាក់បរាជ័យ</div>
          <div style={{ fontSize: 14, color: XCLOUD_THEME.textMain, marginTop: 10 }}>
            Bakong បានបដិសេធការទូទាត់នេះ។ អ្នកមិនទាន់ទទួលបានពិន្ទុទេ។
          </div>
          <div style={{ fontSize: 12, color: XCLOUD_THEME.textMuted, marginTop: 4 }}>
            សូមព្យាយាមស្កេន QR ថ្មីម្តងទៀត ឬទាក់ទងផ្នែកជំនួយប្រសិនបើលុយត្រូវបានកាត់រួច។
          </div>
          <button onClick={resetBakongFlow} style={{ marginTop: 22, padding: '10px 28px', background: XCLOUD_THEME.accentPurple, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            ព្យាយាមម្តងទៀត
          </button>
        </div>
      </>
    )}
    </>
  );
}
