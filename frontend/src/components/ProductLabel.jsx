import React from 'react';

// Shop labels: limited_edition | new_arrival | out_of_stock (anything else = no label)
export const LABEL_OPTIONS = [
  { value: 'none',            text: 'No label' },
  { value: 'new_arrival',     text: 'New Arrival' },
  { value: 'limited_edition', text: 'Limited Edition' },
  { value: 'out_of_stock',    text: 'Out of Stock' },
];

const STYLES = {
  limited_edition: { text: 'LIMITED EDITION', bg: 'linear-gradient(135deg,#f5c14b,#e8963a)', color: '#2a1700' },
  new_arrival:     { text: 'NEW ARRIVAL',     bg: '#34d399', color: '#04231a' },
  out_of_stock:    { text: 'OUT OF STOCK',    bg: '#ef4444', color: '#ffffff' },
};

export default function ProductLabel({ label, style }) {
  const s = STYLES[label];
  if (!s) return null;
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
      padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', ...style,
    }}>{s.text}</span>
  );
}
