import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 15000,
});

const HEALTH_PATH = '/api/health';
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;
let keepAliveIntervalId;
let healthPingInFlight = false;

let authToken = null;
const LEGACY_TOKEN_KEY = 'chatbox-token';
localStorage.removeItem(LEGACY_TOKEN_KEY);
sessionStorage.removeItem(LEGACY_TOKEN_KEY);

export async function pingBackendHealth() {
  if (healthPingInFlight) return;
  healthPingInFlight = true;
  try {
    const healthUrl = new URL(HEALTH_PATH, api.defaults.baseURL);
    const response = await fetch(healthUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.type !== 'opaque' && !response.ok) {
      console.warn(`ChatBox backend health ping returned HTTP ${response.status}.`);
    }
  } catch (error) {
    console.warn('ChatBox backend health ping failed:', error);
  } finally {
    healthPingInFlight = false;
  }
}

export function startBackendKeepAlive() {
  if (keepAliveIntervalId !== undefined) return;
  void pingBackendHealth();
  keepAliveIntervalId = window.setInterval(() => {
    void pingBackendHealth();
  }, KEEP_ALIVE_INTERVAL_MS);
}

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
