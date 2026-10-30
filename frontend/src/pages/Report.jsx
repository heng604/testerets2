import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const API = '';

const CATEGORY_KEYS = ['bug', 'payment', 'product', 'account', 'other'];
const CATEGORY_ICONS = { bug: '🐛', payment: '💳', product: '📦', account: '👤', other: '💬' };
const CATEGORY_LABELS_EN = { bug: 'Bug / Error', payment: 'Payment Issue', product: 'Product Issue', account: 'Account Issue', other: 'Other' };
const CATEGORY_LABELS_KM = { bug: 'បញ្ហាកម្មវិធី (Bug)', payment: 'បញ្ហាការទូទាត់', product: 'បញ្ហាផលិតផល', account: 'បញ្ហាគណនី', other: 'ផ្សេងៗ' };

const STATUS_COLORS = {
  open:        { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#ef4444'  },
  'in-review': { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', text: '#fbbf24'  },
  resolved:    { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#10b981'  },
  closed:      { bg: 'rgba(71,85,105,0.12)',  border: 'rgba(71,85,105,0.35)',  text: '#64748b'  },
};

const STATUS_LABELS_EN = { open: '🔴 Open', 'in-review': '🟡 In Review', resolved: '✅ Resolved', closed: '⛔ Closed' };
const STATUS_LABELS_KM = { open: '🔴 កំពុងបើក', 'in-review': '🟡 កំពុងត្រួតពិនិត្យ', resolved: '✅ ដោះស្រាយរួច', closed: '⛔ បិទ' };

export default function Report({ userEmail, username }) {
  const { colors: XCLOUD_THEME } = useTheme();
  const { t, lang } = useLanguage();
  const CATEGORIES = CATEGORY_KEYS.map(k => ({ value: k, label: `${CATEGORY_ICONS[k]} ${(lang === 'km' ? CATEGORY_LABELS_KM : CATEGORY_LABELS_EN)[k]}` }));
  const STATUS_LABELS = lang === 'km' ? STATUS_LABELS_KM : STATUS_LABELS_EN;

  const [tab, setTab]         = useState('submit');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const inputBase = {
    width: '100%', padding: '11px 14px', background: XCLOUD_THEME.bgInput,
    border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '8px',
    color: XCLOUD_THEME.textMain, fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };
  const labelBase = {
    display: 'block', fontSize: '11px', color: XCLOUD_THEME.textMuted,
    fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  const loadMyReports = useCallback(() => {
    if (!userEmail) return;
    setLoadingReports(true);
    fetch(`${API}/api/reports/by-email/${encodeURIComponent(userEmail)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setMyReports(Array.isArray(d) ? d : []))
      .catch(() => setMyReports([]))
      .finally(() => setLoadingReports(false));
  }, [userEmail]);

  useEffect(() => { if (tab === 'history') loadMyReports(); }, [tab, loadMyReports]);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      alert('សូមបំពេញ Subject និង Message');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          username: username || userEmail?.split('@')[0] || 'User',
          subject: subject.trim(),
          category,
          message: message.trim(),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      setSuccess(true);
      setSubject('');
      setMessage('');
      setCategory('other');
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      alert('ការផ្ញើបរាជ័យ: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: XCLOUD_THEME.bgDark, color: XCLOUD_THEME.textMain, padding: '36px 20px', fontFamily: "'Hanuman','Khmer','Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 6px', color: XCLOUD_THEME.textMain }}>{t('report.title')}</h1>
          <p style={{ color: XCLOUD_THEME.textMuted, fontSize: '13px', margin: 0 }}>
            {t('report.subtitle')} {userEmail}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[
            { key: 'submit',  label: t('report.tab.submit') },
            { key: 'history', label: t('report.tab.history') },
          ].map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{
              padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', border: 'none',
              background: tab === tb.key ? '#d97706' : XCLOUD_THEME.bgCard,
              color:      tab === tb.key ? '#fff'    : XCLOUD_THEME.textMuted,
              outline: tab === tb.key ? '1px solid #f59e0b' : `1px solid ${XCLOUD_THEME.border}`,
            }}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* ── Submit Form ── */}
        {tab === 'submit' && (
          <div style={{ background: XCLOUD_THEME.bgCard, borderRadius: '14px', border: `1px solid ${XCLOUD_THEME.border}`, padding: '28px 30px' }}>

            {success && (
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', color: '#10b981', fontWeight: '700', fontSize: '14px' }}>
                {t('report.successMsg')}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Category */}
              <div>
                <label style={labelBase}>{t('report.category')}</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label style={labelBase}>{t('report.subject')} <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder={t('report.subjectPlaceholder')}
                  style={inputBase}
                  maxLength={120}
                />
              </div>

              {/* Message */}
              <div>
                <label style={labelBase}>{t('report.message')} <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('report.messagePlaceholder')}
                  rows={6}
                  style={{ ...inputBase, resize: 'vertical', lineHeight: '1.6' }}
                  maxLength={2000}
                />
                <div style={{ textAlign: 'right', color: XCLOUD_THEME.textMuted, fontSize: '11px', marginTop: '4px' }}>{message.length}/2000</div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={sending}
                style={{
                  padding: '13px', background: sending ? '#374151' : '#d97706', border: 'none',
                  borderRadius: '8px', color: '#fff', fontWeight: '800', fontSize: '15px',
                  cursor: sending ? 'not-allowed' : 'pointer', width: '100%',
                }}
              >
                {sending ? t('report.sending') : t('report.sendButton')}
              </button>
            </div>
          </div>
        )}

        {/* ── History ── */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ color: XCLOUD_THEME.textMuted, fontSize: '13px' }}>{myReports.length} {t('report.count')}</span>
              <button onClick={loadMyReports} style={{ padding: '7px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '7px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                {t('report.refresh')}
              </button>
            </div>
            {loadingReports && <div style={{ color: XCLOUD_THEME.textMuted, textAlign: 'center', padding: '40px' }}>{t('report.loading')}</div>}
            {!loadingReports && myReports.length === 0 && (
              <div style={{ color: XCLOUD_THEME.textMuted, textAlign: 'center', padding: '50px', background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}` }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <div>{t('report.noReports')}</div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myReports.map(r => {
                const sc = STATUS_COLORS[r.status] || STATUS_COLORS.open;
                return (
                  <div key={r.reportId} style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '12px', padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: XCLOUD_THEME.textMain }}>{r.subject}</span>
                        <span style={{ marginLeft: '10px', fontSize: '11px', color: XCLOUD_THEME.textMuted, background: 'rgba(128,128,128,0.1)', padding: '2px 8px', borderRadius: '10px', border: `1px solid ${XCLOUD_THEME.border}` }}>
                          {CATEGORIES.find(c => c.value === r.category)?.label || r.category}
                        </span>
                      </div>
                      <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, borderRadius: '20px', padding: '3px 11px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                    <p style={{ color: XCLOUD_THEME.textMuted, fontSize: '13px', margin: '0 0 8px', lineHeight: '1.6' }}>{r.message}</p>
                    {r.adminNote && (
                      <div style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '8px', padding: '10px 14px', marginTop: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '700' }}>{t('report.adminNote')}</span>
                        <span style={{ fontSize: '13px', color: '#fbbf24' }}>{r.adminNote}</span>
                      </div>
                    )}
                    <div style={{ marginTop: '10px', color: XCLOUD_THEME.textMuted, fontSize: '11px' }}>
                      {new Date(r.timestamp).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
