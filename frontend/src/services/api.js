// frontend/src/services/api.js
import axios from 'axios';

/**
 * ============================================================
 * 🌐 Instance Axios globale (Frontend Teranga)
 * ============================================================
 * - Base URL adaptative : env > détection host > fallback /api
 * - Sépare l'origin API (…/api) et l'origin FICHIERS (…/)
 * - Injection du token Bearer
 * - Gestion fine des erreurs (réseau vs 401/403)
 * - Petit retry (1x) sur erreurs réseau + flip host 127⇄localhost en dev
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

/* ---------- Détection ORIGIN & API ---------- */
function resolveOrigins() {
  // 1) Variable d'env (ex: http://localhost:5000)
  const envOrigin = (process.env.REACT_APP_API_URL || '').trim();
  if (envOrigin) {
    const origin = stripTrailingSlash(envOrigin);
    return {
      FILE_BASE_URL: origin,          // sert /uploads
      API_BASE_URL: origin + '/api',  // appels API
    };
  }

  // 2) Heuristique dev locale (127.0.0.1 priorisé pour éviter DNS)
  const host = (typeof window !== 'undefined' && window.location?.hostname) || '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  if (isLocalHost) {
    const origin = 'http://127.0.0.1:5000';
    return {
      FILE_BASE_URL: origin,          // ex: http://127.0.0.1:5000/uploads/...
      API_BASE_URL: origin + '/api',  // ex: http://127.0.0.1:5000/api/...
    };
  }

  // 3) Production / reverse proxy : API mappée sous /api, fichiers sous /uploads à la racine
  return {
    FILE_BASE_URL: '',     // même origin que le front (ex: https://app.mondomaine.com)
    API_BASE_URL: '/api',
  };
}

const ORIGINS = resolveOrigins();

export const API_BASE_URL = ORIGINS.API_BASE_URL;
export let FILE_BASE_URL = ORIGINS.FILE_BASE_URL;
const AUTH_STORAGE_MODE = (process.env.REACT_APP_AUTH_STORAGE || 'localstorage')
  .toLowerCase()
  .trim();

function shouldUseLocalStorage() {
  return AUTH_STORAGE_MODE !== 'cookie';
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
  const storedToken =
    localStorage.getItem('teranga_token') || localStorage.getItem('token');
  // Fallback: si un token existe, on l'envoie même en mode cookie
  // (évite les 401 quand la config env est incohérente avec l'état client)
  const token = shouldUseLocalStorage() ? storedToken : storedToken;

  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCookieValue('teranga_csrf');
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

/* ---------- Helper: retry réseau léger + flip host dev ---------- */
function shouldRetryNetwork(error) {
  // Pas de réponse = réseau (ERR_CONNECTION_REFUSED, offline, CORS dur)
  const cfg = error?.config;
  if (!error?.response && cfg && cfg.method === 'get') {
    // On autorise uniquement 1 retry très léger
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
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    let cfg = error?.config || {};
    const url = cfg?.url;
    const method = cfg?.method;

    // Log utile en dev (non bloquant)
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

    // 1) Erreurs réseau (pas de response) → pas de redirect/logout
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

    // 2) 401 → Token invalide/expiré ⇒ nettoyage + redirection unique vers /login
    if (status === 401) {
      localStorage.removeItem('teranga_token');
      localStorage.removeItem('token');

      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      // Évite de boucler si on est déjà sur /login
      if (path !== '/login' && typeof window !== 'undefined' && !window.__TERANGA_REDIRECT_LOCK) {
        window.__TERANGA_REDIRECT_LOCK = true;
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // 3) 403 → ACL (autorisation insuffisante) → pas de logout
    if (status === 403) {
      console.warn('⚠️ Accès refusé (403) pour', method?.toUpperCase?.(), url);
      return Promise.reject(error);
    }

    // 4) Autres erreurs (400, 404, 500, …) → on remonte
    return Promise.reject(error);
  }
);

/* ---------- Exports utilitaires ---------- */
/** Permet de changer dynamiquement l'URL de base si besoin */
export function setApiBaseUrl(newBaseUrl) {
  if (typeof newBaseUrl === 'string' && newBaseUrl.trim()) {
    const sanitized = stripTrailingSlash(newBaseUrl);
    api.defaults.baseURL = sanitized;

    // Met à jour automatiquement FILE_BASE_URL en retirant un éventuel "/api"
    FILE_BASE_URL = sanitized.replace(/\/api\/?$/, '');
    if (typeof window !== 'undefined') {
      window.__TERANGA_API_BASE_URL = api.defaults.baseURL;
      window.__TERANGA_FILE_BASE_URL = FILE_BASE_URL;
    }
  }
}

/** Expose l’instance Axios */
export default api;
