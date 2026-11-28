import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL
  || import.meta.env.VITE_BACKEND_URL
  || 'https://chatbox-pgpf.onrender.com';

const api = axios.create({
  baseURL: BASE_URL,
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
    await fetch(healthUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    // Keep-alive is best-effort and must not interrupt app startup.
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
