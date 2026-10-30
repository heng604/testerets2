import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { injectGlobalStyles } from './styles/theme';
import { useTheme } from './context/ThemeContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';

import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Topup from './pages/Topup';
import Report from './pages/Report';

import { fetchPendingUpdates } from './services/api';

injectGlobalStyles();

const INITIAL_PRODUCTS_DATABASE = [
  {
    _id: '687cfd07bab6a7f27f30c7f1',
    title: 'Scania Astwo 2.2',
    priceInPoints: 900,
    ownerName: 'Masatoshi',
    description: 'v1.2.7 Plus OUT NOW for Euro Truck Simulator 2',
    isNew: true,
    images: [
      'https://i.imgur.com/B9P6w0t.jpeg',
      'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?q=80&w=600',
    ],
    downloadUrl: 'https://drive.google.com',
    discountCode: 'FREE50',
    details: ['ផ្នែកខាងក្រោយ ១', 'ផ្នែកខាងមុខ ១', 'ស្កឺត ៣ (Customs)', 'ទ្វារអាចបើកបិទបាន'],
    screenshots: ['https://i.imgur.com/B9P6w0t.jpeg'],
  },
  {
    _id: '687cfd07bab6a7f27f30c7f2',
    title: 'Scania Euro7',
    priceInPoints: 1200,
    ownerName: 'Masatoshi',
    description: 'Scania Euro7 Premium Edition',
    images: ['https://i.imgur.com/B9P6w0t.jpeg'],
    downloadUrl: 'https://drive.google.com',
    discountCode: '',
    details: ['រៀបចំពេញកម្លាំង', 'គាំទ្រកំណែចុងក្រោយបំផុត'],
    screenshots: [],
  },
];

export default function App() {
  const { colors } = useTheme();
  const [products, setProducts] = useState(INITIAL_PRODUCTS_DATABASE);
  const [userPoints, setUserPoints] = useState(0);
  const [userRole, setUserRole] = useState('guest');
  const [userEmail, setUserEmail] = useState('');

  const [purchasedItems, setPurchasedItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('purchasedItems') || '[]'); } catch { return []; }
  });
  const [transactions, setTransactions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('transactions') || '[]'); } catch { return []; }
  });
  const [pendingDeposits, setPendingDeposits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pendingDeposits') || '[]'); } catch { return []; }
  });

  // Real counts for the public homepage stats (សមាជិក / ការបញ្ជាទិញ) — pulled
  // straight from the database via the same endpoints the admin panel uses,
  // not from localStorage, so they reflect the actual data and only change
  // when an admin adds/removes a user, product, or order.
  const [memberCount, setMemberCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [pendingUpdates, setPendingUpdates] = useState({ count: 0, items: [] });

  // Restore session
  useEffect(() => {
    try {
      const storedRole  = localStorage.getItem('userRole');
      const storedEmail = localStorage.getItem('userEmail');
      if (storedRole && storedRole !== 'guest') setUserRole(storedRole);
      if (storedEmail) setUserEmail(storedEmail);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('purchasedItems', JSON.stringify(purchasedItems)); } catch {}
  }, [purchasedItems]);

  useEffect(() => {
    try { localStorage.setItem('transactions', JSON.stringify(transactions)); } catch {}
  }, [transactions]);

  useEffect(() => {
    try { localStorage.setItem('pendingDeposits', JSON.stringify(pendingDeposits)); } catch {}
  }, [pendingDeposits]);

  const handleLogout = () => {
    setUserRole('guest');
    setUserEmail('');
    try {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('authToken');
    } catch {}
  };

  // Sync points from backend every 5s — also force-logout if the account
  // gets banned/deleted by an admin while the user is already logged in
  useEffect(() => {
    if (!userEmail) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/users/points/${encodeURIComponent(userEmail)}?check=session`);
        if (res.status === 403) {
          handleLogout();
          alert('🚫 គណនីរបស់អ្នកត្រូវបានលុប ឬហាមឃាត់ដោយអ្នកគ្រប់គ្រង។ អ្នកត្រូវចេញពីប្រព័ន្ធ។');
          window.location.href = '/login';
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (typeof data.points === 'number') setUserPoints(data.points);
        }
      } catch {}
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [userEmail]);

  // Poll pending product updates every 30s (only for logged-in non-guest users)
  useEffect(() => {
    if (!userEmail || userRole === 'guest') return;
    const load = () => {
      fetchPendingUpdates(userEmail)
        .then(data => setPendingUpdates(data))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [userEmail, userRole]);

  // Fetch products from backend
  useEffect(() => {
    axios.get('/api/products')
      .then(res => { if (Array.isArray(res.data) && res.data.length > 0) setProducts(res.data); })
      .catch(() => {});
  }, []);

  // Fetch real member (user) count and order count for the homepage stats
  useEffect(() => {
    axios.get('/api/users')
      .then(res => {
        if (Array.isArray(res.data)) {
          setMemberCount(res.data.length);
          console.log('[Home stats] សមាជិក (users) loaded:', res.data.length);
        } else {
          console.warn('[Home stats] /api/users did not return an array:', res.data);
        }
      })
      .catch(err => console.warn('[Home stats] failed to load /api/users — is the backend running on :5000?', err.message));
    axios.get('/api/orders')
      .then(res => {
        if (Array.isArray(res.data)) {
          setOrderCount(res.data.length);
          console.log('[Home stats] ការបញ្ជាទិញ (orders) loaded:', res.data.length);
        } else {
          console.warn('[Home stats] /api/orders did not return an array:', res.data);
        }
      })
      .catch(err => console.warn('[Home stats] failed to load /api/orders — is the backend running on :5000?', err.message));
  }, []);

  const isLoggedIn = userRole !== 'guest';
  const sharedProductProps = { products, userPoints, setUserPoints, purchasedItems, setPurchasedItems, setTransactions, userRole, userEmail };

  return (
    <Router>
      <div style={{ backgroundColor: colors.bgDark, color: colors.textMain, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', transition: 'background-color 0.2s ease, color 0.2s ease' }}>

        <Navbar userPoints={userPoints} handleLogout={handleLogout} userRole={userRole} userEmail={userEmail} pendingUpdates={pendingUpdates} />

        <div style={{ flex: 1 }}>
          <Routes>
            {/* Public */}
            <Route path="/"         element={<Home products={products} transactions={transactions} memberCount={memberCount} orderCount={orderCount} />} />
            <Route path="/products" element={<Products products={products} />} />
            <Route path="/login"    element={<Login setUserRole={setUserRole} setUserEmail={setUserEmail} />} />

            {/* User protected */}
            <Route path="/mod/:id"  element={isLoggedIn ? <ProductDetail {...sharedProductProps} /> : <Navigate to="/login" replace />} />
            <Route path="/profile"  element={isLoggedIn
              ? <Profile userEmail={userEmail} userPoints={userPoints} setUserPoints={setUserPoints} purchasedItems={purchasedItems} products={products} pendingDeposits={pendingDeposits} setPendingDeposits={setPendingDeposits} transactions={transactions} setTransactions={setTransactions} handleLogout={handleLogout} />
              : <Navigate to="/login" replace />}
            />
            <Route path="/topup"    element={isLoggedIn
              ? <Topup userEmail={userEmail} pendingDeposits={pendingDeposits} setPendingDeposits={setPendingDeposits} setTransactions={setTransactions} userPoints={userPoints} setUserPoints={setUserPoints} />
              : <Navigate to="/login" replace />}
            />
            <Route path="/report"   element={isLoggedIn
              ? <Report userEmail={userEmail} username={userEmail?.split('@')[0]} />
              : <Navigate to="/login" replace />}
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </Router>
  );
}
