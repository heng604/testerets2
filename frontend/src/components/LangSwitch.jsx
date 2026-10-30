import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import Icon from './Icon';

// Segmented  EN | ខ្មែរ  pill. Uses the existing toggleLang(), so it only flips when needed.
export default function LangSwitch({ compact }) {
  const { lang, toggleLang } = useLanguage();
  const seg = (active) => ({
    padding: compact ? '6px 10px' : '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
    background: active ? 'linear-gradient(135deg,#7c5cff,#22d3ee)' : 'transparent', color: active ? '#fff' : '#a6a3c4',
    boxShadow: active ? '0 4px 14px rgba(124,92,255,0.45)' : 'none', transition: 'all .2s',
  });
  return (
    <div className="ai-seg" role="group" aria-label="Language" style={{
      display: 'inline-flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 999,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
    }}>
      {!compact && <Icon name="globe" size={14} style={{ margin: '0 4px 0 8px', color: '#a6a3c4' }} />}
      <button type="button" style={seg(lang === 'en')} onClick={() => lang !== 'en' && toggleLang()}>EN</button>
      <button type="button" style={seg(lang === 'km')} onClick={() => lang !== 'km' && toggleLang()}>ខ្មែរ</button>
    </div>
  );
}
