import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 15000,
});

const TOKEN_KEY = 'chatbox-token';

export function getAuthToken() {
  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved) return saved;
  const legacyToken = sessionStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    localStorage.setItem(TOKEN_KEY, legacyToken);
    sessionStorage.removeItem(TOKEN_KEY);
  }
  return legacyToken;
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getErrorMessage(error) {
  return error.response?.data?.error || error.message || 'Something went wrong.';
}

export default api;
