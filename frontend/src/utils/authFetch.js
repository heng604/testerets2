// Adds the server-issued admin/user JWT to every same-site /api request, so the
// existing pages (which call fetch/axios directly) keep working unchanged.
import axios from 'axios';

const TOKEN_KEY = 'authToken';
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const isApi = (url) => typeof url === 'string' && (url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`));

function onExpired() {
  try { ['authToken', 'userRole', 'userEmail'].forEach((k) => localStorage.removeItem(k)); } catch {}
  if (window.location.pathname.startsWith('/admin')) window.location.assign('/admin/');
}

if (!window.__authFetchInstalled) {
  window.__authFetchInstalled = true;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input && input.url;
    const token = getToken();
    if (token && isApi(url)) {
      const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      init = { ...init, headers };
    }
    const res = await origFetch(input, init);
    if (res.status === 401 && token && isApi(url) && url.indexOf('/api/auth/') === -1 && window.location.pathname.startsWith('/admin')) onExpired();
    return res;
  };
  axios.interceptors.request.use((cfg) => {
    const token = getToken();
    if (token && isApi(cfg.url)) cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
    return cfg;
  });
}
