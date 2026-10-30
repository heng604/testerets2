import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DARK_THEME, LIGHT_THEME } from '../styles/theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem('themeMode') || 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem('themeMode', mode); } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', mode);
      document.body.style.background = (mode === 'dark' ? DARK_THEME : LIGHT_THEME).bgDark;
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const colors = mode === 'dark' ? DARK_THEME : LIGHT_THEME;

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a <ThemeProvider>');
  return ctx;
}
