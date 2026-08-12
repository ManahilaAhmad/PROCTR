const getHost = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

export const API_BASE_URL = `http://${getHost()}:5000/api`;
export const SERVER_BASE_URL = `http://${getHost()}:5000`;
export default API_BASE_URL;
