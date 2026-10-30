import React, { useEffect, useState } from 'react';
import { XCLOUD_THEME } from '../styles/theme';
import { verifyDeposit, fetchSettings, fetchBakongDeposits } from '../services/api';
import { formatDateTime } from '../utils/dateUtils';

const BAKONG_STATUS_LABEL = {
  pending:  { text: 'កំពុងរង់ចាំបង់ប្រាក់', color: '#fbbf24' },
  approved: { text: 'បង់ប្រាក់ជោគជ័យ',       color: '#10b981' },
  rejected: { text: 'បដិសេធ',                 color: '#ef4444' },
  expired:  { text: 'QR ផុតកំណត់',            color: '#64748b' },
};

export default function Topups({ pendingDeposits, setPendingDeposits, setTransactions, setUserPoints, loggedInEmail }) {
  const [selectedSlipUrl, setSelectedSlipUrl] = useState(null);
  const [pointRate, setPointRate] = useState(100);

  // ── Bakong KHQR auto top-ups (read-only — verified & credited automatically) ──
  const [bakongDeposits, setBakongDeposits] = useState([]);
  const [bakongLoading, setBakongLoading]   = useState(true);
  const [bakongError, setBakongError]       = useState(null);

  const loadBakongDeposits = () => {
    fetchBakongDeposits()
      .then(data => { setBakongDeposits(Array.isArray(data) ? data : []); setBakongError(null); })
      .catch(() => setBakongError('មិនអាចទាញយកទិន្នន័យ Bakong បានទេ។'))
      .finally(() => setBakongLoading(false));
  };

  useEffect(() => {
    loadBakongDeposits();
    // Poll every 10s so a payment that just came in shows up without a manual refresh.
    const interval = setInterval(loadBakongDeposits, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load the admin-configured point rate, and keep polling — if the rate is
  // changed elsewhere (Settings tab) while this page stays open, the preview
  // below should follow along instead of showing a stale number.
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

  const toPoints = (amount) => Math.floor((parseFloat(amount) || 0) / pointRate);

  const handleVerify = async (depositId, action) => {
    const transaction = pendingDeposits.find(d => d.id === depositId);
    if (!transaction) return;
    try {
      const res = await verifyDeposit(depositId, action);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Verify failed'); }
      const result = await res.json();

      if (action === 'approve') {
        // Trust the server's figure — it converts amount → points using the
        // LIVE admin-configured rate at the exact moment of approval, so this
        // stays correct even if the rate changed after the user paid.
        const addedPoints = result.pointsAdded;
        if (result.user?.points != null && loggedInEmail === transaction.user) setUserPoints(result.user.points);
        alert(`អនុម័តជោគជ័យ! +${addedPoints} ពិន្ទុ → ${transaction.user}`);
        setTransactions(prev => prev.map(tx => tx.id === depositId
          ? { ...tx, status: 'approved', points: addedPoints, pointRateUsed: result.pointRateUsed }
          : tx));
      } else {
        alert('បានបដិសេធវិក្កយបត្រ។');
        setTransactions(prev => prev.map(tx => tx.id === depositId ? { ...tx, status: 'rejected' } : tx));
      }
      setPendingDeposits(prev => prev.filter(d => d.id !== depositId));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '40px 80px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* ══════════════ Bakong KHQR Auto Top-ups (read-only) ══════════════ */}
      <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px' }}>
        ⚡ Bakong ស្វ័យប្រវត្តិ ({bakongDeposits.length})
      </h2>
      <div style={{ fontSize: '12px', color: '#475569', marginBottom: '20px' }}>
        ទិន្នន័យទាំងនេះត្រូវបានផ្ទៀងផ្ទាត់ និងបូកពិន្ទុដោយស្វ័យប្រវត្តិ — មិនត្រូវការសកម្មភាពពីអ្នកគ្រប់គ្រងទេ។
      </div>

      <div style={{ background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}`, overflow: 'hidden', marginBottom: '40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0a0a0f', borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>លេខសម្គាល់ / កាលបរិច្ឆេទ</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>អ្នកប្រើប្រាស់</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>ចំនួនទឹកប្រាក់</th>
              <th style={{ padding: '16px 20px', color: '#64748b', textAlign: 'right' }}>ស្ថានភាព</th>
            </tr>
          </thead>
          <tbody>
            {bakongDeposits.map(dep => {
              const label = BAKONG_STATUS_LABEL[dep.status] || { text: dep.status, color: '#94a3b8' };
              return (
                <tr key={dep.depositId} className="xc-admin-row" style={{ borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
                  <td style={{ padding: '16px 20px', color: '#fff' }}>
                    <div>{dep.depositId}</div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                      {formatDateTime(dep.timestamp)}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: '#94a3b8' }}>{dep.userEmail}</td>
                  <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: '700' }}>
                    {Number(dep.amount).toLocaleString()} {dep.currency} → {dep.points} ពិន្ទុ
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', color: label.color, fontWeight: '700' }}>
                    {label.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!bakongLoading && bakongDeposits.length === 0 && !bakongError && (
          <div style={{ color: '#475569', textAlign: 'center', padding: '30px', fontSize: '14px' }}>មិនទាន់មានការបង់ប្រាក់តាម Bakong នៅឡើយទេ។</div>
        )}
        {bakongError && (
          <div style={{ color: '#ef4444', textAlign: 'center', padding: '30px', fontSize: '14px' }}>{bakongError}</div>
        )}
      </div>

      {/* ══════════════ Manual slip-upload deposits (requires approval) ══════════════ */}
      <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#fbbf24', marginBottom: '8px' }}>
        💰 ជួររង់ចាំពិនិត្យវិក្កយបត្រ ({pendingDeposits.length})
      </h2>
      <div style={{ fontSize: '12px', color: '#475569', marginBottom: '20px' }}>
        អត្រាបំប្លែងបច្ចុប្បន្ន: 1 ពិន្ទុ = {pointRate.toLocaleString()} ៛
      </div>

      <div style={{ background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0a0a0f', borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>លេខសម្គាល់ / កាលបរិច្ឆេទ</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>អ្នកប្រើប្រាស់ / ឆានែល</th>
              <th style={{ padding: '16px 20px', color: '#64748b' }}>ចំនួនទឹកប្រាក់</th>
              <th style={{ padding: '16px 20px', color: '#64748b', textAlign: 'right' }}>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {pendingDeposits.map(dep => (
              <tr key={dep.id} className="xc-admin-row" style={{ borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
                <td style={{ padding: '16px 20px', color: '#fff' }}>
                  <div>{dep.id}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{formatDateTime(dep.timestamp)}</div>
                </td>
                <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                  <div>{dep.user}</div>
                  <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>{dep.method}</div>
                </td>
                <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: '700' }}>
                  {dep.amount?.toLocaleString()} ៛ → {toPoints(dep.amount)} ពិន្ទុ
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                  <button onClick={() => setSelectedSlipUrl(dep.slipUrl)} style={{ background: '#1c1540', border: '1px solid #312e81', color: '#fbbf24', padding: '6px 12px', borderRadius: '4px', marginRight: '8px', cursor: 'pointer', fontWeight: '600' }}>🖼️ Slip</button>
                  <button onClick={() => handleVerify(dep.id, 'approve')} style={{ background: XCLOUD_THEME.accentGreen, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', marginRight: '8px', cursor: 'pointer', fontWeight: '600' }}>អនុម័ត</button>
                  <button onClick={() => handleVerify(dep.id, 'reject')} style={{ background: XCLOUD_THEME.accentDanger, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>បដិសេធ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pendingDeposits.length === 0 && (
          <div style={{ color: '#475569', textAlign: 'center', padding: '30px', fontSize: '14px' }}>មិនមានវិក្កយបត្ររង់ចាំការត្រួតពិនិត្យទេ។</div>
        )}
      </div>

      {/* Slip Modal */}
      {selectedSlipUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(4,4,6,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#100d1c', border: '1px solid #241f3a', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: '700' }}>ពិនិត្យភស្តុតាងផ្ទេរប្រាក់</h3>
              <button onClick={() => setSelectedSlipUrl(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <img src={selectedSlipUrl} alt="slip" style={{ width: '100%', borderRadius: '8px', border: '1px solid #241f3a' }} />
          </div>
        </div>
      )}
    </div>
  );
}
