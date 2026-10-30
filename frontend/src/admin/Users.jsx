import React, { useState, useEffect } from 'react';
import { XCLOUD_THEME } from '../styles/theme';

function EditUserModal({ user, onClose, onSave }) {
  const [points, setPoints] = useState(user.points || 0);
  const [role, setRole] = useState(user.role || 'user');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: parseFloat(points), role }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Update failed'); }
      const data = await res.json();
      onSave(data.user);
      onClose();
    } catch (err) {
      alert('ការកែប្រែបរាជ័យ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: '#0a0a0f',
    border: '1px solid #1e293b', borderRadius: '8px', color: '#e6edf3',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', color: '#64748b', fontSize: '12px', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1001, background: '#14110f', border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '16px', padding: '28px 32px', width: '100%', maxWidth: '440px', boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>✏️ កែប្រែអ្នកប្រើប្រាស់</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '22px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#0a0a0f', borderRadius: '10px', border: '1px solid #1e293b' }}>
          <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>EMAIL</div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>{user.email}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>ពិន្ទុ (Points)</label>
            <input type="number" min="0" value={points} onChange={e => setPoints(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>តួនាទី (Role)</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '8px', color: '#64748b', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
              បោះបង់
            </button>
            <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '12px', background: saving ? '#374151' : '#d97706', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '⏳ កំពុងរក្សាទុក...' : '💾 រក្សាទុក'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function DeleteConfirmModal({ user, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.email)}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Delete failed'); }
      onDeleted(user.email);
      onClose();
    } catch (err) {
      alert('លុបបរាជ័យ: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1001, background: '#14110f', border: '1px solid #7f1d1d', borderRadius: '16px', padding: '28px 32px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗑️</div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: '0 0 8px 0' }}>លុបអ្នកប្រើប្រាស់?</h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            អ្នកប្រើប្រាស់ <span style={{ color: '#fca5a5', fontWeight: '700' }}>{user.email}</span> នឹងត្រូវបានលុបចោលជាអចិន្ត្រៃយ៍ រួមទាំងប្រវត្តិ Topup ទាំងអស់។ អ៊ីមែលនេះនឹងត្រូវបាន <b>ហាមឃាត់ (banned)</b> មិនអាចចូលប្រើម្តងទៀតបានទេ លុះត្រាតែអ្នកដោះហាមឃាត់វា។
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '8px', color: '#64748b', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
            បោះបង់
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{ flex: 2, padding: '12px', background: deleting ? '#374151' : '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: deleting ? 'not-allowed' : 'pointer' }}>
            {deleting ? '⏳ កំពុងលុប...' : '🗑️ លុបចោល'}
          </button>
        </div>
      </div>
    </>
  );
}

function BannedList() {
  const [banned, setBanned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const loadBanned = () => {
    setLoading(true);
    fetch('/api/users/banned')
      .then(r => r.ok ? r.json() : [])
      .then(data => setBanned(Array.isArray(data) ? data : []))
      .catch(() => setBanned([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (open) loadBanned(); }, [open]);

  const handleUnban = async (email) => {
    try {
      const res = await fetch(`/api/users/banned/${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Unban failed'); }
      setBanned(prev => prev.filter(b => b.email !== email));
    } catch (err) {
      alert('ដោះហាមឃាត់បរាជ័យ: ' + err.message);
    }
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'transparent', border: `1px solid ${XCLOUD_THEME.border}`, color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
      >
        {open ? '▾' : '▸'} 🚫 អ៊ីមែលដែលហាមឃាត់ (Banned Emails){banned.length > 0 ? ` (${banned.length})` : ''}
      </button>

      {open && (
        <div style={{ marginTop: '14px', background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}`, overflow: 'hidden' }}>
          {loading && <div style={{ color: '#475569', textAlign: 'center', padding: '20px', fontSize: '13px' }}>🔄 កំពុងផ្ទុក...</div>}
          {!loading && banned.length === 0 && (
            <div style={{ color: '#475569', textAlign: 'center', padding: '20px', fontSize: '13px' }}>មិនមានអ៊ីមែលហាមឃាត់ទេ។</div>
          )}
          {!loading && banned.map(b => (
            <div key={b.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
              <div>
                <div style={{ color: '#fca5a5', fontWeight: 600, fontSize: '13px' }}>{b.email}</div>
                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                  {b.reason || 'Deleted by admin'} · {b.bannedAt ? new Date(b.bannedAt).toLocaleString() : ''}
                </div>
              </div>
              <button
                onClick={() => handleUnban(b.email)}
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
              >
                ✅ ដោះហាមឃាត់
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [search, setSearch] = useState('');

  const loadUsers = () => {
    setLoading(true);
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSaveUser = (updatedUser) => {
    setUsers(prev => prev.map(u => u.email === updatedUser.email ? { ...u, ...updatedUser } : u));
  };

  const handleDeleted = (email) => {
    setUsers(prev => prev.filter(u => u.email !== email));
  };

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPoints = users.reduce((s, u) => s + (u.points || 0), 0);
  const totalTopups = users.reduce((s, u) => s + (u.totalTopups || 0), 0);
  const totalLogins = users.reduce((s, u) => s + (u.loginCount || 0), 0);

  return (
    <div style={{ padding: '40px 80px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'អ្នកប្រើប្រាស់ (Users)', value: users.length, icon: '👥', color: '#fbbf24' },
          { label: 'ការចូល (Total Logins)', value: totalLogins.toLocaleString(), icon: '🔐', color: '#38bdf8' },
          { label: 'ការបញ្ចូលពិន្ទុ (Topups)', value: totalTopups.toLocaleString(), icon: '💰', color: '#fbbf24' },
          { label: 'ពិន្ទុរួម (Total Points)', value: totalPoints.toLocaleString(), icon: '🪙', color: '#10b981' },
        ].map(stat => (
          <div key={stat.label} style={{ background: XCLOUD_THEME.bgCard, border: `1px solid ${XCLOUD_THEME.border}`, borderRadius: '12px', padding: '20px 22px' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>{stat.icon}</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#fff' }}>
          👥 អ្នកប្រើប្រាស់ ({filtered.length}{search ? `/${users.length}` : ''})
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ស្វែងរក email..."
            style={{ padding: '9px 14px', background: '#0a0a0f', border: '1px solid #1e293b', borderRadius: '8px', color: '#e6edf3', fontSize: '13px', outline: 'none', width: '220px' }}
          />
          <button onClick={loadUsers} style={{ padding: '9px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
            🔄 ផ្ទុកឡើងវិញ
          </button>
        </div>
      </div>

      <div style={{ background: XCLOUD_THEME.bgCard, borderRadius: '12px', border: `1px solid ${XCLOUD_THEME.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0a0a0f', borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
              <th style={{ padding: '14px 20px', color: '#64748b' }}>Email</th>
              <th style={{ padding: '14px 20px', color: '#64748b' }}>តួនាទី</th>
              <th style={{ padding: '14px 20px', color: '#64748b' }}>ពិន្ទុ</th>
              <th style={{ padding: '14px 20px', color: '#64748b' }}>ចូល (Logins)</th>
              <th style={{ padding: '14px 20px', color: '#64748b' }}>Topup Slots</th>
              <th style={{ padding: '14px 20px', color: '#64748b' }}>ចូលចុងក្រោយ</th>
              <th style={{ padding: '14px 20px', color: '#64748b', textAlign: 'right' }}>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, idx) => (
              <tr key={user._id || user.email || idx} className="xc-admin-row" style={{ borderBottom: `1px solid ${XCLOUD_THEME.border}` }}>
                <td style={{ padding: '14px 20px', color: '#fff', fontWeight: 600 }}>
                  <div>{user.email || '—'}</div>
                  {user.username && <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{user.username}</div>}
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ background: user.role === 'admin' ? 'rgba(251,191,36,0.15)' : 'rgba(217,119,6,0.15)', color: user.role === 'admin' ? '#fbbf24' : '#fbbf24', border: `1px solid ${user.role === 'admin' ? 'rgba(251,191,36,0.3)' : 'rgba(217,119,6,0.3)'}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    {user.role || 'user'}
                  </span>
                </td>
                <td style={{ padding: '14px 20px', color: '#10b981', fontWeight: 700 }}>{(user.points || 0).toLocaleString()} ពិន្ទុ</td>
                <td style={{ padding: '14px 20px', color: '#38bdf8', fontWeight: 700 }}>
                  <span style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px' }}>
                    🔐 {user.loginCount || 0}x
                  </span>
                </td>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', color: '#fbbf24', fontWeight: '700' }}>
                      💰 {user.totalTopups || 0} ដង
                    </span>
                    {user.totalTopupAmount > 0 && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{(user.totalTopupAmount || 0).toLocaleString()} ៛</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '14px 20px', color: '#475569', fontSize: 12 }}>
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <button
                    onClick={() => setEditingUser(user)}
                    style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)', color: '#fbbf24', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', marginRight: '8px' }}
                  >
                    ✏️ កែប្រែ
                  </button>
                  <button
                    onClick={() => setDeletingUser(user)}
                    style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}
                  >
                    🗑️ លុប
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div style={{ color: '#475569', textAlign: 'center', padding: '30px', fontSize: '14px' }}>🔄 កំពុងផ្ទុក...</div>}
        {!loading && filtered.length === 0 && <div style={{ color: '#475569', textAlign: 'center', padding: '30px', fontSize: '14px' }}>មិនមានអ្នកប្រើប្រាស់ណាមួយទេ។</div>}
      </div>

      <BannedList />

      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaveUser} />
      )}
      {deletingUser && (
        <DeleteConfirmModal user={deletingUser} onClose={() => setDeletingUser(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
