import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 15000,
});

let authToken = null;
const LEGACY_TOKEN_KEY = 'chatbox-token';
localStorage.removeItem(LEGACY_TOKEN_KEY);
sessionStorage.removeItem(LEGACY_TOKEN_KEY);

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = token || null;
}

export function clearAuthToken() {
  authToken = null;
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
