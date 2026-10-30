const BASE_URL = '/api';

// Backend origin (no trailing /api) — used to resolve relative image paths
// like "/img/banner-xxx.jpg" (returned by /api/settings) into a real,
// loadable <img> src. Without this, the browser resolves "/img/..." against
// the STOREFRONT's own origin (e.g. http://localhost:5173) instead of the
// backend that actually serves the file (http://localhost:5000), so the
// image 404s even though the admin upload succeeded. Mirrors the
// resolveBannerUrl() helper already used by the admin panel.
export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

export const resolveBannerUrl = (src) => {
  if (!src) return src;
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src; // already absolute
  return `${API_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`;
};

// --- USERS ---
export const fetchUserPoints = (email) =>
  fetch(`${BASE_URL}/users/points/${encodeURIComponent(email)}`).then(r => r.ok ? r.json() : null);

export const fetchUserAvatar = (email) =>
  fetch(`${BASE_URL}/users/avatar/${encodeURIComponent(email)}`).then(r => r.ok ? r.json() : null);

export const updateUserAvatar = (email, avatar) =>
  fetch(`${BASE_URL}/users/avatar/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar }),
  });

// --- PRODUCTS ---
export const fetchProducts = () =>
  fetch(`${BASE_URL}/products`).then(r => r.ok ? r.json() : []);

export const deleteProduct = (id) =>
  fetch(`${BASE_URL}/products/${id}`, { method: 'DELETE' });

export const purchaseProduct = (productId, userEmail, finalPrice) =>
  fetch(`${BASE_URL}/products/${productId}/purchase-by-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail, finalPrice }),
  });

// --- PURCHASES (Profile page: Download vs Update button) ---
// Backed entirely by the database — survives logout/clearing the browser,
// and only changes when the admin updates the product or deletes a record.
export const fetchPurchasesByEmail = (email) =>
  fetch(`${BASE_URL}/purchases/by-email/${encodeURIComponent(email)}`).then(r => r.ok ? r.json() : []);

export const acknowledgeProductUpdate = (purchaseId) =>
  fetch(`${BASE_URL}/purchases/${purchaseId}/acknowledge-update`, { method: 'POST' });

// Called the first time the user downloads from the PRODUCT PAGE (not Profile).
// Marks this purchase as downloaded so the product page switches its button to
// "ទិញម្ដងទៀត" (Buy Again) afterwards.
export const markPurchaseDownloaded = (purchaseId) =>
  fetch(`${BASE_URL}/purchases/${purchaseId}/mark-downloaded`, { method: 'POST' });

// Returns { count, items: [{ purchaseId, productId, title }] } for the bell badge.
// Derived from the same getPurchasesByEmail endpoint — no new backend route needed.
export const fetchPendingUpdates = async (email) => {
  const purchases = await fetchPurchasesByEmail(email);
  const items = purchases
    .filter(p => p.needsUpdate)
    .map(p => ({ purchaseId: p.purchaseId, productId: p.product._id, title: p.product.title }));
  return { count: items.length, items };
};

export const uploadMod = (payload) =>
  fetch(`${BASE_URL}/log-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

// --- DEPOSITS ---
export const fetchPendingDeposits = () =>
  fetch(`${BASE_URL}/deposits/pending`).then(r => r.ok ? r.json() : Promise.reject(r.status));

export const submitDeposit = (payload) =>
  fetch(`${BASE_URL}/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const verifyDeposit = (depositId, action) =>
  fetch(`${BASE_URL}/deposits/${depositId}/verify`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });

// Admin: read-only feed of Bakong KHQR auto top-ups (pending/approved/rejected/expired)
export const fetchBakongDeposits = () =>
  fetch(`${BASE_URL}/deposits/bakong`).then(r => r.ok ? r.json() : Promise.reject(r.status));

// --- BAKONG KHQR AUTO TOP-UP ---
export const generateBakongQR = (payload) =>
  fetch(`${BASE_URL}/bakong/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to generate QR');
    return data;
  });

export const checkBakongStatus = (depositId) =>
  fetch(`${BASE_URL}/bakong/status/${depositId}`).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to check status');
    return data;
  });

// --- CLOUDINARY ---
export const uploadSlipToCloudinary = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'masatoshi ecommerce');
    formData.append('folder', 'slips');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/dbvs9yxyk/image/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        let msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).error?.message || msg; } catch (e) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error — check your internet connection'));
    xhr.send(formData);
  });
};

// --- AUTH (role resolution) ---
// Throws a BannedError if the backend reports the email as banned, or a
// LockedOutError if the banned email has been spamming login attempts,
// so the login screen can stop the user instead of silently logging them in.
export class BannedError extends Error {}
export class LockedOutError extends Error {
  constructor(message, secondsLeft) {
    super(message);
    this.secondsLeft = secondsLeft;
  }
}

export const resolveUserRole = async (email) => {
  try {
    const res = await fetch(`${BASE_URL}/users/points/${encodeURIComponent(email)}`);
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      throw new LockedOutError(data.error || 'Too many attempts. Try again later.', data.secondsLeft || 0);
    }
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      throw new BannedError(data.error || 'This account has been banned.');
    }
    if (res.ok) {
      const data = await res.json();
      return data.role || 'user';
    }
  } catch (e) {
    if (e instanceof BannedError || e instanceof LockedOutError) throw e;
    console.warn('Backend role check failed:', e.message);
  }
  return email === 'seangheng2006@gmail.com' ? 'admin' : 'user';
};

// Admin: clear the update notification for all buyers of a product
export const clearProductUpdate = (id) =>
  fetch(`${BASE_URL}/products/${id}/clear-update`, { method: 'POST' });

// --- SETTINGS ---
export const fetchSettings = () =>
  fetch(`${BASE_URL}/settings`).then(r => r.ok ? r.json() : null);

export const updateSettings = (payload) =>
  fetch(`${BASE_URL}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => r.json());
