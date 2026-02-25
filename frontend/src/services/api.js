// frontend/src/services/api.js
import axios from 'axios';

/**
 * ============================================================
 * 🌐 Instance Axios globale (Frontend Teranga)
 * ============================================================
 * - Base URL adaptative : env > détection host > fallback /api
 * - Separe l'origin API (.../api) et l'origin FICHIERS (.../)
 * - Injection du token Bearer
 * - Gestion fine des erreurs (réseau vs 401/403)
 * - Petit retry (1x) sur erreurs reseau + flip host 127localhost en dev
 * ============================================================
 */

/* ---------- Helpers URL ---------- */
function stripTrailingSlash(s) {
  return (s || '').replace(/\/+$/, '');
}
function ensureLeadingSlash(s) {
  return s ? (s.startsWith('/') ? s : '/' + s) : '';
}
function joinUrl(base, path) {
  return stripTrailingSlash(base) + ensureLeadingSlash(path);
}

function normalizeStoredToken(value) {
  const raw = typeof value === 'string' ? value.trim() : String(value || '').trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;
  return raw;
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    if (value == null || value === '') {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, String(value));
  } catch {
    // ignore storage errors (quota, disabled storage, SSR)
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/* ---------- Détection ORIGIN & API ---------- */
function resolveOrigins() {
  // 1) Variables d'env explicites
  const envApiBase = (process.env.REACT_APP_API_BASE_URL || '').trim();
  const envApiUrl = (process.env.REACT_APP_API_URL || '').trim();
  const envFileBase = (process.env.REACT_APP_FILE_BASE_URL || '').trim();

  if (envApiBase || envApiUrl || envFileBase) {
    const apiBaseRaw = stripTrailingSlash(envApiBase || envApiUrl);
    const apiBase = apiBaseRaw.endsWith('/api') ? apiBaseRaw : `${apiBaseRaw}/api`;
    const fileBase =
      stripTrailingSlash(envFileBase) ||
      stripTrailingSlash(apiBase.replace(/\/api$/, ''));

    return {
      FILE_BASE_URL: fileBase, // sert /uploads
      API_BASE_URL: apiBase, // appels API
    };
  }

 // 2) Heuristique dev locale (127.0.0.1 priorise pour eviter DNS)
  const host = (typeof window !== 'undefined' && window.location?.hostname) || '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  if (isLocalHost) {
    const backendHost = host === '127.0.0.1' ? '127.0.0.1' : 'localhost';
    const origin = `http://${backendHost}:5000`;
    return {
      FILE_BASE_URL: origin,          // ex: http://127.0.0.1:5000/uploads/...
      API_BASE_URL: origin + '/api',  // ex: http://127.0.0.1:5000/api/...
    };
  }

 // 3) Production / reverse proxy : API mappee sous /api, fichiers sous /uploads a la racine
  return {
    FILE_BASE_URL: '',     // même origin que le front (ex: https://app.mondomaine.com)
    API_BASE_URL: '/api',
  };
}

const ORIGINS = resolveOrigins();

export const API_BASE_URL = ORIGINS.API_BASE_URL;
export let FILE_BASE_URL = ORIGINS.FILE_BASE_URL;
const AUTH_STORAGE_MODE = String(
  process.env.REACT_APP_AUTH_STORAGE || 'localstorage'
).toLowerCase().trim();
const COOKIE_BEARER_FALLBACK_RAW = String(
  process.env.REACT_APP_COOKIE_BEARER_FALLBACK || ''
).toLowerCase().trim();
const TOKEN_STORAGE_KEYS = ['teranga_token', 'token'];
const USER_STORAGE_KEY = 'teranga_user';
const CSRF_TOKEN_STORAGE_KEY = 'teranga_csrf_token';
const CSRF_COOKIE_NAME = 'teranga_csrf';
let refreshAccessPromise = null;

function parseBooleanLike(value, fallback = false) {
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function usesCookieAuth() {
  return AUTH_STORAGE_MODE === 'cookie';
}

function usesCookieBearerFallback() {
  if (!usesCookieAuth()) return true;
  return parseBooleanLike(COOKIE_BEARER_FALLBACK_RAW, true);
}

function canUseStoredBearer() {
  return !usesCookieAuth() || usesCookieBearerFallback();
}

if (usesCookieAuth() && !usesCookieBearerFallback()) {
  TOKEN_STORAGE_KEYS.forEach((key) => safeStorageRemove(key));
}

/* ---------- Création instance Axios ---------- */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

/* ---------- Exposer FILE_BASE_URL au runtime (debug/interop) ---------- */
if (typeof window !== 'undefined') {
  window.__TERANGA_API_BASE_URL = API_BASE_URL;
  window.__TERANGA_FILE_BASE_URL = FILE_BASE_URL;
}

/* ---------- Utilitaire public: URL de fichier statique ---------- */
/** Construit l'URL absolue vers un fichier servi par le backend (ex: /uploads/xxx.pdf) */
export function getFileUrl(filePath) {
  if (!filePath) return '';
  // filePath commence normalement par "/uploads/..."
  return joinUrl(FILE_BASE_URL || '', filePath);
}

/* ---------- Intercepteur: injecter token ---------- */
api.interceptors.request.use((config) => {
  const skipAuthHeader = Boolean(config?.skipAuthHeader);

  if (skipAuthHeader) {
    if (config?.headers) {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }
  }

  const existingAuth =
    config?.headers?.Authorization || config?.headers?.authorization || '';
  const normalizedExistingAuth = String(existingAuth).trim().toLowerCase();

  // Certains écrans envoient parfois "Bearer null"/"Bearer undefined":
  // on l'ignore pour laisser l'intercepteur injecter le vrai token (ou la session cookie).
  if (
    normalizedExistingAuth === '' ||
    normalizedExistingAuth === 'bearer null' ||
    normalizedExistingAuth === 'bearer undefined' ||
    normalizedExistingAuth === 'bearer'
  ) {
    if (config?.headers) {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }
  }

  const storedToken = canUseStoredBearer()
    ? normalizeStoredToken(
        safeStorageGet('teranga_token') || safeStorageGet('token')
      )
    : null;

  // Envoie le Bearer si disponible. En mode cookie, /auth/me gère le fallback
  // sans header si le Bearer est stale mais le cookie est valide.
  if (
    !skipAuthHeader &&
    storedToken &&
    !config.headers?.Authorization &&
    !config.headers?.authorization
  ) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${storedToken}`;
  }

  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf =
      getCookieValue('teranga_csrf') ||
      safeStorageGet(CSRF_TOKEN_STORAGE_KEY);
    if (csrf) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = csrf;
    }
  }

  // Marqueurs internes pour retry
  if (config.__retryCount === undefined) config.__retryCount = 0;
  if (config.__flippedHost === undefined) config.__flippedHost = false;

  return config;
});

function getCookieValue(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getRequestPath(url) {
  const raw = typeof url === 'string' ? url : '';
  if (!raw) return '';
  try {
    return new URL(raw, 'http://localhost').pathname;
  } catch {
    return raw;
  }
}

function isAuthRefreshRequest(url) {
  return /\/auth\/refresh(?:\/|$)/.test(getRequestPath(url));
}

function isNonRefreshableAuth401Request(url) {
  const path = getRequestPath(url);
  if (!path) return false;
  return [
    /\/auth\/login(?:\/|$)/,
    /\/auth\/register(?:\/|$)/,
    /\/auth\/refresh(?:\/|$)/,
    /\/auth\/forgot-password(?:\/|$)/,
    /\/auth\/reset-password(?:\/|$)/,
    /\/auth\/recover-with-code(?:\/|$)/,
  ].some((rx) => rx.test(path));
}

function hasRefreshSessionHint() {
  const storedToken = canUseStoredBearer()
    ? normalizeStoredToken(
        safeStorageGet('teranga_token') || safeStorageGet('token')
      )
    : null;
  const csrfCookie = normalizeStoredToken(getCookieValue(CSRF_COOKIE_NAME));
  const csrfStorage = normalizeStoredToken(safeStorageGet(CSRF_TOKEN_STORAGE_KEY));
  return Boolean(storedToken || csrfCookie || csrfStorage);
}

function clearStoredAuthSession() {
  TOKEN_STORAGE_KEYS.forEach((key) => safeStorageRemove(key));
  safeStorageRemove(USER_STORAGE_KEY);
  safeStorageRemove(CSRF_TOKEN_STORAGE_KEY);
}

function persistRefreshedSession(data) {
  const refreshedToken = normalizeStoredToken(data?.token);
  if (refreshedToken && canUseStoredBearer()) {
    TOKEN_STORAGE_KEYS.forEach((key) => safeStorageSet(key, refreshedToken));
  } else if (usesCookieAuth()) {
    TOKEN_STORAGE_KEYS.forEach((key) => safeStorageRemove(key));
  }

  const csrfToken = normalizeStoredToken(data?.csrfToken);
  if (csrfToken) {
    safeStorageSet(CSRF_TOKEN_STORAGE_KEY, csrfToken);
  }
}

function clearAuthorizationHeader(config) {
  if (!config?.headers) return;
  delete config.headers.Authorization;
  delete config.headers.authorization;
}

function shouldAttemptAuthRefresh(status, config) {
  if (status !== 401 || !config) return false;
  if (config.skipAuthRefresh) return false;
  if (config.__isRetryAfterRefresh) return false;
  if (isNonRefreshableAuth401Request(config.url)) return false;
  if (!hasRefreshSessionHint()) return false;
  return true;
}

async function refreshAccessSession() {
  if (refreshAccessPromise) return refreshAccessPromise;

  refreshAccessPromise = (async () => {
    const { data } = await api.post(
      '/auth/refresh',
      {},
      {
        skipAuthRedirect: true,
        silentAuth: true,
        skipAuthRefresh: true,
        skipAuthHeader: true,
      }
    );
    persistRefreshedSession(data);
    return data;
  })();

  try {
    return await refreshAccessPromise;
  } finally {
    refreshAccessPromise = null;
  }
}

/* ---------- Helper: retry reseau leger + flip host dev ---------- */
function shouldRetryNetwork(error) {
 // Pas de reponse = reseau (ERR_CONNECTION_REFUSED, offline, CORS dur)
  const cfg = error?.config;
  if (!error?.response && cfg && cfg.method === 'get') {
 // On autorise uniquement 1 retry tres leger
    return (cfg.__retryCount || 0) < 1;
  }
  return false;
}

/** Flip host 127.0.0.1 <-> localhost une fois, utile en dev */
function tryFlipDevHostOnce(cfg) {
  try {
    if (!cfg?.baseURL || cfg.__flippedHost) return cfg;

    const is127 = cfg.baseURL.includes('127.0.0.1');
    const isLocal = cfg.baseURL.includes('localhost');

    if (is127 || isLocal) {
      const flipped = is127
        ? cfg.baseURL.replace('127.0.0.1', 'localhost')
        : cfg.baseURL.replace('localhost', '127.0.0.1');

      const newCfg = { ...cfg, baseURL: flipped, __flippedHost: true };
      return newCfg;
    }
  } catch {
    /* ignore */
  }
  return cfg;
}

/* ---------- Intercepteur: gestion d’erreurs ---------- */
api.interceptors.response.use(
  (response) => {
    try {
      const method = (response?.config?.method || 'get').toUpperCase();
      const url = response?.config?.url || '';
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        // Evite la boucle sur les endpoints notifications
        if (!/\/notifications(\/|$)/.test(url) && !isAuthRefreshRequest(url)) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('notifications:refresh'));
          }
        }
      }
    } catch {
      /* ignore */
    }
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    let cfg = error?.config || {};
    const url = cfg?.url;
    const method = cfg?.method;

    // Log utile en dev (non bloquant)
    const silentAuth = Boolean(cfg?.silentAuth);
    if (!silentAuth) {
      try {
        console.error('❌ API ERROR:', {
          url,
          method,
          status,
          data: error?.response?.data,
        });
      } catch {
        // ignore
      }
    }

 // 1) Erreurs reseau (pas de response) pas de redirect/logout
    if (!error?.response) {
      // Petit retry GET (1x)
      if (shouldRetryNetwork(error)) {
        try {
          await new Promise((r) => setTimeout(r, 200)); // backoff court
          cfg.__retryCount = (cfg.__retryCount || 0) + 1;

          // En dev, tenter un flip 127 <-> localhost une seule fois
          cfg = tryFlipDevHostOnce(cfg);

          return api.request(cfg);
        } catch (e) {
          // si le retry échoue, on laisse remonter l'erreur
        }
      }
      return Promise.reject(error);
    }

    // 2) 401: tentative de refresh (1x) puis fallback cleanup + redirection
    if (status === 401) {
      if (shouldAttemptAuthRefresh(status, cfg)) {
        try {
          await refreshAccessSession();
          cfg.__isRetryAfterRefresh = true;
          clearAuthorizationHeader(cfg); // force re-injection du nouveau Bearer
          return api.request(cfg);
        } catch (refreshError) {
          if (!silentAuth) {
            try {
              console.warn(' Refresh auto echoue, fallback sur gestion 401 standard', {
                refreshStatus: refreshError?.response?.status,
                refreshData: refreshError?.response?.data,
              });
            } catch {
              // ignore
            }
          }
        }
      }

      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const skipRedirect =
        cfg?.skipAuthRedirect ||
        cfg?.silentAuth ||
        path === '/login' ||
        path === '/register' ||
        path === '/forgot-password' ||
        path === '/reset-password';

      // Pour les appels "silencieux" (ex: notifications), ne pas purger la session.
      if (!skipRedirect) {
        clearStoredAuthSession();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('teranga_auth_changed'));
        }
      }

      if (
        !skipRedirect &&
        typeof window !== 'undefined' &&
        !window.__TERANGA_REDIRECT_LOCK
      ) {
        window.__TERANGA_REDIRECT_LOCK = true;
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

 // 3) 403 ACL (autorisation insuffisante) pas de logout
    if (status === 403) {
      console.warn(' Acces refuse (403) pour', method?.toUpperCase?.(), url);
      return Promise.reject(error);
    }

 // 4) Autres erreurs (400, 404, 500, ...) on remonte
    return Promise.reject(error);
  }
);

/* ---------- Exports utilitaires ---------- */
/** Permet de changer dynamiquement l'URL de base si besoin */
export function setApiBaseUrl(newBaseUrl) {
  if (typeof newBaseUrl === 'string' && newBaseUrl.trim()) {
    const sanitized = stripTrailingSlash(newBaseUrl);
    api.defaults.baseURL = sanitized;

 // Met a jour automatiquement FILE_BASE_URL en retirant un eventuel "/api"
    FILE_BASE_URL = sanitized.replace(/\/api\/?$/, '');
    if (typeof window !== 'undefined') {
      window.__TERANGA_API_BASE_URL = api.defaults.baseURL;
      window.__TERANGA_FILE_BASE_URL = FILE_BASE_URL;
    }
  }
}

/** Expose l’instance Axios */
export default api;
