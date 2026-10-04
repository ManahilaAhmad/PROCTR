const getHost = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

export const API_BASE_URL = `http://${getHost()}:5000/api`;
export const SERVER_BASE_URL = `http://${getHost()}:5000`;

export function installAuthenticatedFetch() {
  if (typeof window === 'undefined' || window.__proctrAuthenticatedFetchInstalled) return;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, options = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    let isBackendRequest = false;
    try {
      isBackendRequest = new URL(rawUrl, window.location.origin).origin === new URL(SERVER_BASE_URL).origin;
    } catch {
      isBackendRequest = false;
    }

    if (!isBackendRequest) return nativeFetch(input, options);

    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    try {
      const user = JSON.parse(localStorage.getItem('proctr_user') || 'null');
      if (user?.sessionToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${user.sessionToken}`);
      }
    } catch {
      // A damaged local session is handled normally by the API's 401 response.
    }
    return nativeFetch(input, { ...options, headers });
  };

  window.__proctrAuthenticatedFetchInstalled = true;
}

export default API_BASE_URL;
