import React, { useState, useEffect, useRef, useCallback } from 'react';

// Admin tool: "Does Bakong actually work on this server?"
//  1) Run diagnostics  → config, token expiry, can this server reach NBC?
//  2) Create test QR   → pay a tiny amount, see if verification detects it (no points are credited)

const C = { card: '#14110f', border: '#2a2420', text: '#f5efe6', muted: '#a39a8e', accent: '#f59e0b', ok: '#34d399', warn: '#fbbf24', bad: '#f87171' };
const ICON = { pass: '✅', warn: '⚠️', fail: '❌', skip: '⏭️' };
const COLOR = { pass: C.ok, warn: C.warn, fail: C.bad, skip: C.muted };

const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 };
const btn = (primary, disabled) => ({
  background: primary ? C.accent : 'transparent', color: primary ? '#1a1206' : C.text,
  border: `1px solid ${primary ? C.accent : C.border}`, borderRadius: 10, padding: '10px 18px',
  fontWeight: 700, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
});
const input = { background: '#0c0a09', border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none' };

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function BakongTester() {
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagErr, setDiagErr] = useState('');

  const [currency, setCurrency] = useState('KHR');
  const [amount, setAmount] = useState('100');
  const [qr, setQr] = useState(null);          // { testId, qrImage, amount, currency, expiresAt }
  const [qrLoading, setQrLoading] = useState(false);
  const [qrErr, setQrErr] = useState('');
  const [result, setResult] = useState(null);  // { status, message, ... }
  const [checking, setChecking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [history, setHistory] = useState([]);
  const pollRef = useRef(null);

  const loadHistory = useCallback(() => {
    api('/api/admin/bakong/history').then(setHistory).catch(() => {});
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runDiagnostics = async () => {
    setDiagLoading(true); setDiagErr('');
    try { setDiag(await api('/api/admin/bakong/diagnose', { method: 'POST' })); loadHistory(); }
    catch (e) { setDiagErr(e.message); }
    finally { setDiagLoading(false); }
  };

  const createQr = async () => {
    setQrLoading(true); setQrErr(''); setResult(null); setQr(null);
    try {
      const data = await api('/api/admin/bakong/test-qr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, amount: parseFloat(amount) }),
      });
      setQr(data); loadHistory();
    } catch (e) { setQrErr(e.message); }
    finally { setQrLoading(false); }
  };

  const checkNow = useCallback(async (silent) => {
    if (!qr || !qr.testId) return;
    if (!silent) setChecking(true);
    try {
      const r = await api(`/api/admin/bakong/test-qr/${qr.testId}/check`);
      setResult(r);
      if (r.status !== 'pending') { clearInterval(pollRef.current); loadHistory(); }
    } catch (e) { setResult({ status: 'error', message: e.message }); clearInterval(pollRef.current); }
    finally { if (!silent) setChecking(false); }
  }, [qr, loadHistory]);

  // auto-poll every 4s while the test QR is waiting for payment
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!qr) return undefined;
    pollRef.current = setInterval(() => checkNow(true), 4000);
    return () => clearInterval(pollRef.current);
  }, [qr, checkNow]);

  // countdown
  useEffect(() => {
    if (!qr) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((qr.expiresAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [qr]);

  const overallColor = diag ? COLOR[diag.overall] : C.muted;
  const paid = result && result.status === 'paid';

  return (
    <div style={{ display: 'grid', gap: 22, fontFamily: 'Inter, system-ui, sans-serif', color: C.text }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Bakong Tester</h2>
        <div style={{ color: C.muted, fontSize: 13.5, marginTop: 4 }}>
          Check that Bakong top-up really works before customers use it. Test payments never credit points.
          <span style={{ color: C.muted }}> · ពិនិត្យថាប្រព័ន្ធ Bakong ដំណើរការឬអត់</span>
        </div>
      </div>

      {/* ── 1. Diagnostics ───────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>1 · Connection check</div>
            <div style={{ color: C.muted, fontSize: 12.5, marginTop: 3 }}>Account, token expiry, and whether this server can reach the Bakong API.</div>
          </div>
          <button style={btn(true, diagLoading)} disabled={diagLoading} onClick={runDiagnostics}>
            {diagLoading ? 'Checking…' : diag ? 'Run again' : 'Run diagnostics'}
          </button>
        </div>
        {diagErr && <div style={{ marginTop: 14, color: C.bad, fontSize: 13 }}>❌ {diagErr}</div>}
        {diag && (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${overallColor}55`, background: `${overallColor}14`, color: overallColor, fontWeight: 700, fontSize: 14 }}>
              {diag.overall === 'pass' && 'Bakong looks healthy.'}
              {diag.overall === 'warn' && 'Works, but needs attention.'}
              {diag.overall === 'fail' && 'Bakong is NOT working yet — fix the red items below.'}
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {diag.checks.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: '#0c0a09', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                  <span style={{ fontSize: 16 }}>{ICON[c.status]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: COLOR[c.status] }}>{c.label}</div>
                    <div style={{ color: C.muted, fontSize: 12.5, marginTop: 2, wordBreak: 'break-word' }}>{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ color: C.muted, fontSize: 11.5, marginTop: 10 }}>
              Server region: {diag.server.region} · API: {diag.server.baseUrl}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Test payment ──────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>2 · Test payment</div>
        <div style={{ color: C.muted, fontSize: 12.5, marginTop: 3 }}>
          Creates a real KHQR for a tiny amount. Scan it with any Cambodian banking app and pay — this page then confirms whether Bakong verification detects the payment.
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
          <select value={currency} onChange={e => { setCurrency(e.target.value); setAmount(e.target.value === 'USD' ? '0.01' : '100'); }} style={{ ...input, cursor: 'pointer' }}>
            <option value="KHR">KHR (៛)</option>
            <option value="USD">USD ($)</option>
          </select>
          <input type="number" min="0" step={currency === 'USD' ? '0.01' : '100'} value={amount} onChange={e => setAmount(e.target.value)} style={{ ...input, width: 120 }} />
          <button style={btn(true, qrLoading)} disabled={qrLoading} onClick={createQr}>{qrLoading ? 'Creating…' : 'Create test QR'}</button>
        </div>
        {qrErr && <div style={{ marginTop: 12, color: C.bad, fontSize: 13 }}>❌ {qrErr}</div>}

        {qr && (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 18, alignItems: 'flex-start' }}>
            <div style={{ background: '#fff', padding: 10, borderRadius: 14, position: 'relative' }}>
              <img src={qr.qrImage} alt="Test KHQR" width={220} height={220} style={{ display: 'block', opacity: paid || secondsLeft === 0 ? 0.25 : 1 }} />
              {paid && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>✅</div>}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{qr.currency === 'USD' ? '$' : '៛'}{Number(qr.amount).toLocaleString()}</div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                {secondsLeft > 0 && !paid ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : paid ? 'Paid' : 'Expired'}
              </div>
              {result && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.5,
                  border: `1px solid ${(paid ? C.ok : result.status === 'error' ? C.bad : C.muted)}55`,
                  background: `${paid ? C.ok : result.status === 'error' ? C.bad : C.muted}14`,
                  color: paid ? C.ok : result.status === 'error' ? C.bad : C.text,
                }}>
                  <b>{paid ? 'Bakong works ✅' : result.status === 'error' ? 'Verification problem' : result.status === 'expired' ? 'Expired' : 'Waiting for payment…'}</b>
                  <div style={{ color: paid ? C.ok : C.muted, marginTop: 2 }}>{result.message}</div>
                  {result.latencyMs ? <div style={{ color: C.muted, fontSize: 11.5, marginTop: 4 }}>NBC reply in {result.latencyMs} ms{result.httpStatus ? ` · HTTP ${result.httpStatus}` : ''}</div> : null}
                </div>
              )}
              <button style={{ ...btn(false, checking || paid), marginTop: 12 }} disabled={checking || paid} onClick={() => checkNow(false)}>
                {checking ? 'Checking…' : 'Check payment now'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── History ──────────────────────────────────────── */}
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Recent tests</div>
        {history.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No tests yet.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ color: C.muted, textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>When</th><th style={{ padding: '6px 8px' }}>Type</th><th style={{ padding: '6px 8px' }}>Amount</th><th style={{ padding: '6px 8px' }}>Result</th><th style={{ padding: '6px 8px' }}>Note</th>
              </tr></thead>
              <tbody>
                {history.map(h => {
                  const good = h.status === 'paid' || h.status === 'ok';
                  const bad = h.status === 'error';
                  return (
                    <tr key={h.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{new Date(h.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>{h.kind === 'qr' ? 'Test QR' : 'Diagnostics'}</td>
                      <td style={{ padding: '8px' }}>{h.amount !== null ? `${h.currency === 'USD' ? '$' : '៛'}${h.amount}` : '—'}</td>
                      <td style={{ padding: '8px', color: good ? C.ok : bad ? C.bad : C.muted, fontWeight: 700 }}>{h.status}</td>
                      <td style={{ padding: '8px', color: C.muted, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.message}>{h.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
