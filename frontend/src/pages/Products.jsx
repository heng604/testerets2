import React, { useState } from 'react';
import { productGridLayoutSchema } from '../styles/theme';
import { ProductCard } from '../components/ProductCard';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export default function Products({ products }) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortOpen, setSortOpen] = useState(false);

  const sortOptions = [
    { value: 'newest',     label: t('products.sort.newest') },
    { value: 'price_asc',  label: t('products.sort.priceAsc') },
    { value: 'price_desc', label: t('products.sort.priceDesc') },
    { value: 'name_asc',   label: t('products.sort.nameAsc') },
    { value: 'name_desc',  label: t('products.sort.nameDesc') },
  ];

  const priceRanges = [
    { value: 'all',  label: t('products.price.all'),  color: '#94a3b8' },
    { value: 'low',  label: t('products.price.low'),  color: '#10b981' },
    { value: 'mid',  label: t('products.price.mid'),  color: '#f59e0b' },
    { value: 'high', label: t('products.price.high'), color: '#ef4444' },
  ];

  const filtered = products
    .filter(p => {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    })
    .filter(p => {
      if (priceFilter === 'low')  return p.priceInPoints <= 500;
      if (priceFilter === 'mid')  return p.priceInPoints > 500 && p.priceInPoints <= 1500;
      if (priceFilter === 'high') return p.priceInPoints > 1500;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc')  return a.priceInPoints - b.priceInPoints;
      if (sortBy === 'price_desc') return b.priceInPoints - a.priceInPoints;
      if (sortBy === 'name_asc')   return a.title.localeCompare(b.title);
      if (sortBy === 'name_desc')  return b.title.localeCompare(a.title);
      return 0;
    });

  const selectedSort = sortOptions.find(o => o.value === sortBy);

  return (
    <div className="xc-page-pad" style={{ padding: 'clamp(20px, 4vw, 40px) 80px', maxWidth: '1440px', margin: '0 auto', width: '100%', boxSizing: 'border-box', color: colors.textMain }}>
      {/* Search + Sort */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: colors.textMuted, fontSize: '15px', pointerEvents: 'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('products.searchPlaceholder')}
            style={{ width: '100%', padding: '11px 14px 11px 40px', background: colors.bgInput, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMain, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setSortOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 16px', background: colors.bgInput, border: `1px solid ${colors.border}`, borderRadius: '10px', color: colors.textMain, fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {selectedSort.label}
            <span style={{ color: colors.textMuted, fontSize: '10px', marginLeft: '2px' }}>▼</span>
          </button>
          {sortOpen && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '10px', minWidth: '200px', zIndex: 100, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
              {sortOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                  style={{ padding: '11px 16px', fontSize: '13px', cursor: 'pointer', color: sortBy === opt.value ? '#fbbf24' : colors.textMuted, background: sortBy === opt.value ? 'rgba(217,119,6,0.15)' : 'transparent', fontWeight: sortBy === opt.value ? '700' : '400' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(128,128,128,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = sortBy === opt.value ? 'rgba(217,119,6,0.15)' : 'transparent'}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Price pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {priceRanges.map(r => (
          <button
            key={r.value}
            onClick={() => setPriceFilter(r.value)}
            style={{
              padding: '7px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              border: `1px solid ${priceFilter === r.value ? r.color : colors.border}`,
              background: priceFilter === r.value ? `${r.color}22` : 'transparent',
              color: priceFilter === r.value ? r.color : colors.textMuted,
              transition: 'all 0.15s',
            }}
          >
            {r.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: colors.textMuted, alignSelf: 'center' }}>
          {filtered.length} {t('products.count')}
        </span>
      </div>

      {/* Grid */}
      {filtered.length > 0
        ? <div style={productGridLayoutSchema}>{filtered.map(item => <ProductCard key={item._id} item={item} />)}</div>
        : <div style={{ textAlign: 'center', color: colors.textMuted, padding: '60px 0', fontSize: '14px' }}>{t('products.notFound')}</div>
      }
    </div>
  );
}
