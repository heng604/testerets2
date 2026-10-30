import React from 'react';
import { Link } from 'react-router-dom';
import { XCLOUD_THEME } from '../styles/theme';

// Generic sidebar — pass `links` as [{ to, label }] and `title`
export default function Sidebar({ title = 'Navigation', links = [], children }) {
  return (
    <aside style={{ width: 220, background: '#0a0a10', borderRight: `1px solid ${XCLOUD_THEME.border}`, padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {title && <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>{title}</div>}
      {links.map(link => (
        <Link
          key={link.to}
          to={link.to}
          style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 8, display: 'block' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(217,119,6,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {link.label}
        </Link>
      ))}
      {children}
    </aside>
  );
}
