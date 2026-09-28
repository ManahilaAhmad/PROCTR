const getHost = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${getHost()}:5000/api`).replace(/\/$/, '');
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');
export default API_BASE_URL;
