import './utils/authFetch';
import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './AdminApp';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <AdminApp />
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
