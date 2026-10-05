const getHost = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || `${protocol}//${getHost()}:5000/api`).replace(/\/$/, '');
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

export function installAuthenticatedFetch() {
  if (typeof window === 'undefined' || window.__proctrAuthenticatedFetchInstalled) return;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, options = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    let isBackendRequest;
    try {
      isBackendRequest = new URL(rawUrl, window.location.origin).origin === new URL(SERVER_BASE_URL).origin;
    } catch {
      isBackendRequest = false;
    }

    if (!isBackendRequest) return nativeFetch(input, options);

    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    try {
      const user = JSON.parse(localStorage.getItem('proctr_user') || 'null');
      if (user?.sessionToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${user.sessionToken}`);
    } catch {}
    return nativeFetch(input, { ...options, headers, credentials: options.credentials || 'include' });
  };

  window.__proctrAuthenticatedFetchInstalled = true;
}

export default API_BASE_URL;
