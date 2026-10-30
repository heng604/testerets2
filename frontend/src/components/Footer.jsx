import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchSettings } from '../services/api';

export default function Footer() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [siteName, setSiteName] = useState('Masatoshi');

  useEffect(() => {
    fetchSettings().then(data => { if (data && data.siteName) setSiteName(data.siteName); }).catch(() => {});
  }, []);

  return (
    <footer style={{ padding: '40px 0', borderTop: `1px solid ${colors.border}`, textAlign: 'center', marginTop: 'auto', transition: 'border-color 0.2s ease' }}>
      <p style={{ color: colors.textMuted, fontSize: '12px' }}>© 2026 {siteName}. {t('footer.rights')}</p>
    </footer>
  );
}
