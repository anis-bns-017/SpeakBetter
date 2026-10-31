import axios, { type InternalAxiosRequestConfig } from 'axios';
import {
  createRefreshCoordinator,
  type RefreshResponse,
} from './refreshCoordinator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // ✅ sends cookies automatically
});

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Set by the interceptor on the one retry it makes after refreshing */
    _retry?: boolean;
    /** Also sign the user out when refreshing fails, even for /auth/me */
    redirectOnAuthLost?: boolean;
  }
}

// ---------- Refresh ----------
// A bare instance: no interceptors, so refreshing can never trigger itself.
const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  validateStatus: () => true,
});

const REFRESH_LOCK = 'speakbetter-auth-refresh';
const LAST_REFRESH_KEY = 'speakbetter-auth-last-refresh';

const callRefresh = async (): Promise<RefreshResponse> => {
  try {
    const res = await refreshClient.post('/auth/refresh', {});
    if (res.status >= 200 && res.status < 300) return 'ok';
    if (res.status === 401) {
      // The server answers 401 + REFRESH_RACE when another request already
      // rotated this token (e.g. a second tab); the fresh cookies are on the way
      return res.data?.code === 'REFRESH_RACE' ? 'race' : 'denied';
    }
    return 'error';
  } catch {
    return 'error'; // offline etc.
  }
};

const coordinator = createRefreshCoordinator({
  refresh: callRefresh,
  // One refresh at a time across all tabs of this browser
  withLock: (task) =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(REFRESH_LOCK, task)
      : task(),
  readLastRefresh: () => {
    try {
      return Number(localStorage.getItem(LAST_REFRESH_KEY)) || 0;
    } catch {
      return 0;
    }
  },
  writeLastRefresh: (at) => {
    try {
      localStorage.setItem(LAST_REFRESH_KEY, String(at));
    } catch {
      // storage unavailable: the lock alone still serializes the tabs
    }
  },
});

// Pages an anonymous visitor may be on; sending them to /login again would loop
const PUBLIC_PATHS = ['/login', '/register', '/auth/callback'];

const sendToLogin = () => {
  if (PUBLIC_PATHS.includes(window.location.pathname)) return;
  window.location.href = '/login';
};

// Endpoints whose 401 is an answer, not an expired session
const isCredentialEndpoint = (url = '') =>
  /\/auth\/(login|register|refresh|logout)\b/.test(url);

// ---------- Response interceptor ----------
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isCredentialEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const outcome = await coordinator.refreshSession();

    if (outcome === 'refreshed') {
      return apiClient(originalRequest);
    }

    if (outcome === 'lost') {
      // The startup /auth/me of a signed-out visitor is expected to fail;
      // AuthContext handles that without a redirect.
      const isSessionProbe = /\/auth\/me\b/.test(originalRequest.url ?? '');
      if (!isSessionProbe || originalRequest.redirectOnAuthLost) {
        sendToLogin();
      }
    }

    return Promise.reject(error);
  },
);

// ---------- Keeping long-lived connections signed in ----------
// Access tokens are short-lived, but a socket only checks its cookie when it
// connects. Call this before every (re)connect so an expired access cookie is
// refreshed first instead of the server turning the socket away.
let lastEnsure = { at: 0, result: Promise.resolve(true) };

/** Resolves true when the session is usable, false when the user is signed out */
export const ensureFreshSession = (): Promise<boolean> => {
  if (Date.now() - lastEnsure.at < 10_000) return lastEnsure.result;

  const result = apiClient
    .get('/auth/me', { redirectOnAuthLost: true })
    .then(() => true)
    .catch((error) => error?.response?.status !== 401);

  lastEnsure = { at: Date.now(), result };
  return result;
};
