import React, { useState, useEffect, useCallback } from 'react';
import { XCLOUD_THEME } from '../styles/theme';
import { exportToExcel, exportAllToExcel, exportToPDF, exportAllToPDF } from '../utils/exportUtils';

const API = '';

/* ── Status / Category maps ── */
const STATUS_COLORS = {
  open:        { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',   text: '#ef4444' },
  'in-review': { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)',  text: '#fbbf24' },
  resolved:    { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)',  text: '#10b981' },
  closed:      { bg: 'rgba(71,85,105,0.12)',  border: 'rgba(71,85,105,0.3)',   text: '#64748b' },
};
const STATUS_LABELS = { open: '🔴 Open', 'in-review': '🟡 In Review', resolved: '✅ Resolved', closed: '⛔ Closed' };

const CAT_LABELS = { bug:'🐛 Bug', payment:'💳 Payment', product:'📦 Product', account:'👤 Account', other:'💬 Other' };

/* ── Cols for export ── */
const COLS = {
  users:    [
    { key:'email', label:'Email' }, { key:'username', label:'Username' }, { key:'role', label:'Role' },
    { key:'points', label:'Points' }, { key:'loginCount', label:'Logins' },
    { key:'totalTopups', label:'Topups' }, { key:'totalTopupAmount', label:'Topup Amount' },
    { key:'lastLogin', label:'Last Login' }, { key:'createdAt', label:'Joined' },
  ],
  orders:   [
    { key:'purchaseId', label:'ID' }, { key:'userEmail', label:'Email' },
    { key:'product', label:'Product' }, { key:'pointsSpent', label:'Points Spent' }, { key:'purchasedAt', label:'Date' },
  ],
  payments: [
    { key:'depositId', label:'ID' }, { key:'userEmail', label:'Email' },
    { key:'method', label:'Method' }, { key:'amount', label:'Amount' }, { key:'status', label:'Status' }, { key:'timestamp', label:'Date' },
  ],
  reports:  [
    { key:'reportId', label:'ID' }, { key:'userEmail', label:'Email' }, { key:'username', label:'Username' },
    { key:'category', label:'Category' }, { key:'subject', label:'Subject' }, { key:'message', label:'Message' },
    { key:'status', label:'Status' }, { key:'adminNote', label:'Admin Note' }, { key:'timestamp', label:'Date' },
  ],
};

const LABELS = {
  users:    'Users',
  orders:   'Orders',
  payments: 'Payments',
  reports:  'Reports',
};

/* ── Detail modal ── */
function ReportModal({ report, onClose, onUpdate }) {
  const [status, setStatus]     = useState(report.status);
  const [adminNote, setAdminNote] = useState(report.adminNote || '');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/reports/${report.reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote }),
      });
      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      onUpdate(data.report);
      onClose();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: '#0a0a0f',
    border: '1px solid #1e293b', borderRadius: '8px', color: '#e6edf3',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { display:'block', color:'#64748b', fontSize:'11px', fontWeight:'700', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.05em' };
  const sc = STATUS_COLORS[report.status] || STATUS_COLORS.open;

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', zIndex:1000, backdropFilter:'blur(3px)' }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        zIndex:1001, background:'#100d1c', border:`1px solid ${XCLOUD_THEME.border}`,
        borderRadius:'16px', padding:'28px 32px', width:'100%', maxWidth:'560px',
        boxShadow:'0 24px 60px rgba(0,0,0,0.85)', maxHeight:'88vh', overflowY:'auto',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h3 style={{ fontSize:'17px', fontWeight:'800', color:'#fff', margin:0 }}>📋 Report Detail</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b', fontSize:'22px', cursor:'pointer' }}>✕</button>
        </div>

        {/* Info */}
        <div style={{ background:'#0a0814', borderRadius:'10px', padding:'14px 16px', marginBottom:'16px', border:'1px solid #1e293b' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <span style={{ color:'#94a3b8', fontSize:'12px' }}>{report.userEmail}</span>
            <span style={{ background:sc.bg, border:`1px solid ${sc.border}`, color:sc.text, borderRadius:'20px', padding:'3px 10px', fontSize:'11px', fontWeight:'700' }}>
              {STATUS_LABELS[report.status]}
            </span>
          </div>
          <div style={{ fontWeight:'700', color:'#fff', fontSize:'15px', marginBottom:'6px' }}>{report.subject}</div>
          <div style={{ fontSize:'11px', color:'#475569', marginBottom:'10px' }}>
            {CAT_LABELS[report.category] || report.category} · {new Date(report.timestamp).toLocaleString()}
          </div>
          <p style={{ color:'#94a3b8', fontSize:'13px', margin:0, lineHeight:'1.65', whiteSpace:'pre-wrap' }}>{report.message}</p>
        </div>

        {/* Admin controls */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
              <option value="open">🔴 Open</option>
              <option value="in-review">🟡 In Review</option>
              <option value="resolved">✅ Resolved</option>
              <option value="closed">⛔ Closed</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Admin Note (visible to user)</label>
            <textarea
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              rows={3}
              placeholder="ឆ្លើយតបដល់អ្នកប្រើ..."
              style={{ ...inputStyle, resize:'vertical' }}
            />
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={onClose} style={{ flex:1, padding:'11px', background:'transparent', border:`1px solid ${XCLOUD_THEME.border}`, borderRadius:'8px', color:'#64748b', fontWeight:'700', fontSize:'13px', cursor:'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:'11px', background: saving ? '#374151' : '#7c5cff', border:'none', borderRadius:'8px', color:'#fff', fontWeight:'700', fontSize:'13px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '⏳ Saving...' : '💾 Update Report'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Export Panel ── */
function ExportPanel() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');

  const fetchAndExport = async (dataType, format) => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/api/export/${dataType}`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();

      // Determine which key the data is under
      const key = Object.keys(data)[0]; // e.g. "users", "orders"...
      const rows = data[key] || [];
      const cols = COLS[key] || COLS[dataType] || [];

      if (!rows.length) {
        setMsg(`⚠️ No ${dataType} to export`);
        return;
      }

      if (format === 'excel') {
        await exportToExcel(rows, cols, LABELS[key] || key, `masatoshi_${key}`);
        setMsg(`✅ Downloaded ${rows.length} ${key} as Excel (.xlsx)`);
      } else {
        exportToPDF(rows, cols, LABELS[key] || key, `masatoshi_${key}`);
        setMsg(`✅ Downloaded ${rows.length} ${key} as PDF`);
      }
    } catch (err) {
      setMsg('❌ Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllExport = async (format) => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/api/export/all`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();

      if (format === 'excel') {
        const sheets = await exportAllToExcel(data, COLS, LABELS, 'masatoshi_full_export');
        setMsg(`✅ Downloaded ${sheets} sheet(s) as one Excel workbook`);
      } else {
        exportAllToPDF(data, COLS, LABELS, 'masatoshi_full_export');
        setMsg('✅ Downloaded full export as one PDF file');
      }
    } catch (err) {
      setMsg('❌ Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const btnStyle = (color) => ({
    padding: '8px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '700',
    cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
    background: color === 'green' ? 'rgba(16,185,129,0.15)' : 'rgba(56,189,248,0.12)',
    color:      color === 'green' ? '#10b981'                : '#38bdf8',
    outline:    color === 'green' ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(56,189,248,0.3)',
  });

  const sections = [
    { label: '👥 Users',    type: 'users'    },
    { label: '📋 Orders',   type: 'orders'   },
    { label: '💳 Payments', type: 'payments' },
    { label: '🛠️ Reports',  type: 'reports'  },
  ];

  return (
    <div style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '14px', padding: '24px 28px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', margin: 0 }}>📤 Export Data</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => fetchAllExport('excel')} disabled={loading} style={btnStyle('green')}>📊 All → Excel</button>
          <button onClick={() => fetchAllExport('pdf')} disabled={loading} style={btnStyle('blue')}>🖨️ All → PDF</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
        {sections.map(s => (
          <div key={s.type} style={{ background: '#0a0814', borderRadius: '10px', border: `1px solid ${XCLOUD_THEME.border}`, padding: '14px 16px' }}>
            <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>{s.label}</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => fetchAndExport(s.type, 'excel')} disabled={loading} style={btnStyle('green')}>📊 Excel</button>
              <button onClick={() => fetchAndExport(s.type, 'pdf')} disabled={loading} style={btnStyle('blue')}>PDF</button>
            </div>
          </div>
        ))}
      </div>
      {loading && <div style={{ color: '#64748b', fontSize: '12px', marginTop: '12px' }}>⏳ Generating file...</div>}
      {msg && <div style={{ color: msg.startsWith('✅') ? '#10b981' : '#ef4444', fontSize: '12px', marginTop: '10px', fontWeight: '600' }}>{msg}</div>}
    </div>
  );
}

/* ══ Main Reports Admin Page ══ */
export default function Reports() {
  const [reports, setReports]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [filterStatus, setFilter]   = useState('all');
  const [search, setSearch]         = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/reports`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setReports(Array.isArray(d) ? d : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = (updated) => {
    setReports(prev => prev.map(r => r.reportId === updated.reportId ? updated : r));
  };

  const filtered = reports.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || r.userEmail?.toLowerCase().includes(q) || r.subject?.toLowerCase().includes(q) || r.username?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts = {
    all: reports.length,
    open: reports.filter(r => r.status === 'open').length,
    'in-review': reports.filter(r => r.status === 'in-review').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    closed: reports.filter(r => r.status === 'closed').length,
  };

  return (
    <div style={{ padding: '40px 60px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* ── Export Panel ── */}
      <ExportPanel />

      {/* ── Reports Section ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#fff' }}>🛠️ User Reports</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search email / subject..."
            style={{ padding: '8px 13px', background: '#0a0814', border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '8px', color: '#e6edf3', fontSize: '13px', outline: 'none', width: '220px' }}
          />
          <button onClick={load} style={{ padding: '8px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
            🔄
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'open', 'in-review', 'resolved', 'closed'].map(s => {
          const active = filterStatus === s;
          const sc = STATUS_COLORS[s] || { text: '#94a3b8', border: XCLOUD_THEME.border, bg: '#100d1c' };
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', border: 'none',
              background: active ? sc.bg    : 'transparent',
              color:      active ? sc.text  : '#475569',
              outline:    active ? `1px solid ${sc.border}` : '1px solid #1e293b',
            }}>
              {s === 'all' ? '📋 All' : STATUS_LABELS[s]} ({counts[s]})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0a0814', borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
              <th style={{ padding: '13px 18px', color: '#64748b', textAlign: 'left' }}>User</th>
              <th style={{ padding: '13px 18px', color: '#64748b', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '13px 18px', color: '#64748b', textAlign: 'left' }}>Subject</th>
              <th style={{ padding: '13px 18px', color: '#64748b', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '13px 18px', color: '#64748b', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '13px 18px', color: '#64748b', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const sc = STATUS_COLORS[r.status] || STATUS_COLORS.open;
              return (
                <tr key={r.reportId} className="xc-admin-row" style={{ borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ color: '#fff', fontWeight: '600' }}>{r.userEmail}</div>
                    <div style={{ color: '#475569', fontSize: '11px' }}>{r.username}</div>
                  </td>
                  <td style={{ padding: '13px 18px', color: '#94a3b8' }}>{CAT_LABELS[r.category] || r.category}</td>
                  <td style={{ padding: '13px 18px', color: '#e2e8f0', maxWidth: '240px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</div>
                    {r.adminNote && <div style={{ fontSize: '11px', color: '#a78bfa', marginTop: '2px' }}>💬 Note set</div>}
                  </td>
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' }}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td style={{ padding: '13px 18px', color: '#475569', fontSize: '12px' }}>
                    {new Date(r.timestamp).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                    <button
                      onClick={() => setSelected(r)}
                      style={{ background: 'rgba(124,92,255,0.15)', border: '1px solid rgba(124,92,255,0.3)', color: '#fbbf24', padding: '6px 13px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                    >
                      ✏️ Manage
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && <div style={{ color: '#475569', textAlign: 'center', padding: '32px', fontSize: '14px' }}>🔄 Loading...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ color: '#334155', textAlign: 'center', padding: '40px', fontSize: '14px' }}>
            {search || filterStatus !== 'all' ? 'No reports match your filter.' : '📭 No reports yet.'}
          </div>
        )}
      </div>

      {selected && (
        <ReportModal
          report={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
