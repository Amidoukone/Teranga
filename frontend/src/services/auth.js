// frontend/src/services/auth.js
import api from './api';
import { setLanguage, normalizeLanguage } from '../i18n';

/**
 * ============================================================
 * Module Authentification Teranga (Frontend) Version robuste
 * ============================================================
 * - Stockage tolérant (migration de l'ancien 'token' -> 'teranga_token')
 * - Resilience reseau : /auth/me ne casse pas l'app en cas d'indispo
 * - Fallback offline sur l'utilisateur en cache local
 * - API inchangee pour le reste de l'app (register/login/me/logout/...)
 * ============================================================
 */

const TOKEN_KEY = 'teranga_token';
const LEGACY_TOKEN_KEYS = ['token']; // compat héritée
const USER_KEY = 'teranga_user';
const USER_SYNCED_AT_KEY = 'teranga_user_synced_at';
const CSRF_TOKEN_KEY = 'teranga_csrf_token';
const REFRESH_TOKEN_KEY = 'teranga_refresh_token';
const CSRF_COOKIE = 'teranga_csrf';
const COOKIE_BEARER_FALLBACK_ACTIVE_KEY = 'teranga_cookie_bearer_fallback_active';
const AUTH_STORAGE_MODE = (process.env.REACT_APP_AUTH_STORAGE || 'localstorage')
  .toLowerCase()
  .trim();
const COOKIE_BEARER_FALLBACK_RAW = String(
  process.env.REACT_APP_COOKIE_BEARER_FALLBACK || ''
)
  .toLowerCase()
  .trim();
const DEFAULT_ME_CACHE_TTL_MS = 15000;
const ME_CACHE_TTL_MS = (() => {
  const raw = Number.parseInt(
    String(process.env.REACT_APP_AUTH_ME_CACHE_TTL_MS || ''),
    10
  );
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_ME_CACHE_TTL_MS;
  return raw;
})();

let meRequestPromise = null;

function parseBooleanLike(value, fallback = false) {
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function isCookieAuthMode() {
  return AUTH_STORAGE_MODE === 'cookie';
}

function isRuntimeCookieBearerFallbackActive() {
  return parseBooleanLike(safeGet(COOKIE_BEARER_FALLBACK_ACTIVE_KEY), false);
}

function setRuntimeCookieBearerFallbackActive(active) {
  if (active) {
    safeSet(COOKIE_BEARER_FALLBACK_ACTIVE_KEY, '1');
    return;
  }
  safeRemove(COOKIE_BEARER_FALLBACK_ACTIVE_KEY);
}

function isCookieBearerFallbackEnabled() {
  if (!isCookieAuthMode()) return true;
  return (
    parseBooleanLike(COOKIE_BEARER_FALLBACK_RAW, true) ||
    isRuntimeCookieBearerFallbackActive()
  );
}

function shouldUseLocalStorage() {
  return !isCookieAuthMode();
}

function normalizeTokenValue(value) {
  const raw = typeof value === 'string' ? value.trim() : String(value || '').trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;
  return raw;
}

/* ============================================================
   🔧 Utilitaires internes (robustes)
============================================================ */

/** Retourne le token depuis le nouveau key OU les anciens (puis migre). */
function readTokenAny() {
  if (!shouldUseLocalStorage() && !isCookieBearerFallbackEnabled()) return null;
  return readTokenFromStorage();
}

function readTokenFromStorage() {
 // 1) Nouveau nom (prefere)
  const current = normalizeTokenValue(safeGet(TOKEN_KEY));
  if (current) return current;

  // 2) Anciennes clés (migration)
  for (const k of LEGACY_TOKEN_KEYS) {
    const legacy = normalizeTokenValue(safeGet(k));
    if (legacy) {
      // migration silencieuse
      safeSet(TOKEN_KEY, legacy);
      // On ne supprime pas la legacy tout de suite pour éviter une race condition
      return legacy;
    }
  }
  return null;
}

function readRefreshToken() {
  return normalizeTokenValue(safeGet(REFRESH_TOKEN_KEY));
}

/** Ecrit le token dans la nouvelle cle + (optionnel) legacy pour compat. */
function writeTokenAll(token, { keepLegacy = true } = {}) {
  if (isCookieAuthMode() && !isCookieBearerFallbackEnabled()) {
    removeTokenAll();
    return;
  }
  // On stocke aussi en mode cookie pour fallback Bearer (cookies tiers bloqués).
  safeSet(TOKEN_KEY, token);
  if (keepLegacy) {
    for (const k of LEGACY_TOKEN_KEYS) safeSet(k, token);
  }
  if (isCookieAuthMode() && !parseBooleanLike(COOKIE_BEARER_FALLBACK_RAW, true)) {
    setRuntimeCookieBearerFallbackActive(true);
  }
}

function writeRefreshToken(token) {
  const normalized = normalizeTokenValue(token);
  if (!normalized) {
    safeRemove(REFRESH_TOKEN_KEY);
    return;
  }
  safeSet(REFRESH_TOKEN_KEY, normalized);
  if (isCookieAuthMode() && !parseBooleanLike(COOKIE_BEARER_FALLBACK_RAW, true)) {
    setRuntimeCookieBearerFallbackActive(true);
  }
}

/** Supprime le token de toutes les clés. */
function removeTokenAll() {
  safeRemove(TOKEN_KEY);
  for (const k of LEGACY_TOKEN_KEYS) safeRemove(k);
  safeRemove(REFRESH_TOKEN_KEY);
  setRuntimeCookieBearerFallbackActive(false);
}

function writeCsrfToken(token) {
  if (!token) return;
  safeSet(CSRF_TOKEN_KEY, token);
}

function clearCsrfToken() {
  safeRemove(CSRF_TOKEN_KEY);
}

function syncCsrfToken(data) {
  const token = normalizeTokenValue(data?.csrfToken);
  if (token) writeCsrfToken(token);
}

function readCachedUserSyncedAt() {
  const raw = safeGet(USER_SYNCED_AT_KEY);
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveMeCacheTtlMs(value) {
  if (value === undefined || value === null || value === '') {
    return ME_CACHE_TTL_MS;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return ME_CACHE_TTL_MS;
  return parsed;
}

function readFreshCachedUser(maxAgeMs = ME_CACHE_TTL_MS) {
  const user = readCachedUser();
  if (!user) return null;
  if (maxAgeMs <= 0) return null;

  const syncedAt = readCachedUserSyncedAt();
  if (!syncedAt) return null;
  if (Date.now() - syncedAt > maxAgeMs) return null;

  return user;
}

function hasSessionForMeCache() {
  if (isCookieAuthMode()) {
    return (
      Boolean(readCachedUser()) ||
      hasCookieSessionHint() ||
      Boolean(readTokenAny()) ||
      Boolean(readRefreshToken())
    );
  }
  return Boolean(readTokenAny()) || Boolean(readRefreshToken()) || hasCookie(CSRF_COOKIE);
}

/** Acces localStorage safe (evite exceptions quota, disabled, SSR...) */
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, val) {
  try {
    const normalized =
      key === TOKEN_KEY ||
      key === REFRESH_TOKEN_KEY ||
      LEGACY_TOKEN_KEYS.includes(key)
      ? normalizeTokenValue(val)
      : val;
    if (normalized == null) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, normalized);
  } catch {
    // noop
  }
}
function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

function hasCookie(name) {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${name}=`));
}

function hasCookieSessionHint() {
  return hasCookie(CSRF_COOKIE) || Boolean(safeGet(CSRF_TOKEN_KEY));
}

function clearCookie(name) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Max-Age=0; path=/`;
}

function notifyAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('teranga_auth_changed'));
  }
}

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCachedUser(user, options = {}) {
  const verifiedAt =
    options?.verifiedAt === undefined
      ? user
        ? Date.now()
        : null
      : options.verifiedAt;
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      if (verifiedAt !== null && verifiedAt !== undefined) {
        localStorage.setItem(USER_SYNCED_AT_KEY, String(verifiedAt));
      } else {
        localStorage.removeItem(USER_SYNCED_AT_KEY);
      }
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(USER_SYNCED_AT_KEY);
    }
    notifyAuthChange();
  } catch {
    // noop
  }
}

function syncLanguageFromUser(user) {
  const lang = normalizeLanguage(user?.language);
  if (lang) setLanguage(lang);
}

function shouldRequestSessionFallbackCapability() {
  return isCookieAuthMode() && !parseBooleanLike(COOKIE_BEARER_FALLBACK_RAW, true);
}

async function refreshWithStoredRefreshToken() {
  const refreshToken = readRefreshToken();
  if (!refreshToken) return null;

  const { data } = await api.post(
    '/auth/refresh',
    { refreshToken },
    {
      skipAuthRedirect: true,
      silentAuth: true,
      skipAuthRefresh: true,
      skipAuthHeader: true,
    }
  );

  if (data?.token) {
    setRuntimeCookieBearerFallbackActive(true);
    writeTokenAll(data.token, { keepLegacy: true });
  }
  writeRefreshToken(data?.refreshToken);
  writeCsrfToken(data?.csrfToken);
  return data;
}

async function ensureCookieSessionOrActivateBearerFallback(data) {
  if (!isCookieAuthMode() || parseBooleanLike(COOKIE_BEARER_FALLBACK_RAW, true)) {
    return;
  }

  const token = normalizeTokenValue(data?.token);
  if (!token) return;

  try {
    const response = await api.get('/auth/me', {
      skipAuthRedirect: true,
      silentAuth: true,
      skipAuthHeader: true,
      skipAuthRefresh: true,
      skipCsrfResync: true,
    });
    const verifiedData = response?.data;
    syncCsrfToken(verifiedData);
    if (verifiedData?.user) {
      writeCachedUser(verifiedData.user);
      syncLanguageFromUser(verifiedData.user);
      return;
    }
  } catch (error) {
    console.warn('AuthService cookie session verification warning:', {
      status: error?.response?.status,
      data: error?.response?.data,
      msg: error?.message,
    });
  }

  console.warn(
    'AuthService cookie session verification warning:',
    'falling back to local bearer token'
  );
  setRuntimeCookieBearerFallbackActive(true);
  writeTokenAll(token, { keepLegacy: true });
  writeRefreshToken(data?.refreshToken);
  notifyAuthChange();
}

/* ============================================================
   🔹 Inscription d’un nouvel utilisateur
============================================================ */
export async function register(payload) {
  try {
    const { data } = await api.post('/auth/register', payload);
    return data; // { message, user, token? }
  } catch (error) {
    console.error('AuthService register error:', error);
    throw error;
  }
}

/* ============================================================
   🔹 Persistance de session partagée
   - Utilisée par login() et par tout autre flux qui émet une session
     identique à /auth/login (ex: demande de mission invitée, Lot 2)
   - Stocke le JWT (localStorage ou cookie selon le mode), le CSRF token
     et met le user en cache pour UX immédiate
============================================================ */
export async function persistSession(data) {
  if (!data?.token) {
    throw new Error('Token manquant dans la réponse du serveur');
  }

  if (shouldUseLocalStorage()) {
 // Sauvegarde coherente du token (nouvelle + legacy pour compat)
    writeTokenAll(data.token, { keepLegacy: true });
  } else {
 // Mode cookie:
 // - strict (recommande en production): pas de JWT persiste en localStorage
 // - fallback optionnel: Bearer local si active explicitement
    if (isCookieBearerFallbackEnabled() && data?.token) {
      writeTokenAll(data.token, { keepLegacy: true });
      writeRefreshToken(data?.refreshToken);
    } else {
      removeTokenAll();
    }
  }
  writeCsrfToken(data?.csrfToken);

 // Cache user pour UX immediate
  if (data.user) {
    writeCachedUser(data.user);
    syncLanguageFromUser(data.user);
  }

  await ensureCookieSessionOrActivateBearerFallback(data);

  return data;
}

/* ============================================================
   🔹 Connexion (login)
   - Stocke le JWT dans localStorage (nouvelle + legacy key)
   - Met en cache le user pour UX immédiate
============================================================ */
export async function login(payload) {
  try {
    const loginConfig = shouldRequestSessionFallbackCapability()
      ? {
          headers: {
            'X-Teranga-Session-Fallback': 'bearer',
          },
        }
      : undefined;
    const { data } = await api.post('/auth/login', payload, loginConfig);

    await persistSession(data);

    return data; // { token, user }
  } catch (error) {
    console.error('AuthService login error:', error);
    throw error;
  }
}

/* ============================================================
   🔹 Récupérer l’utilisateur courant (/auth/me)
   - Si pas de token => session invalide : {user:null} (+ purge cache)
   - Si réseau KO → renvoie le user caché (si dispo) sinon {user:null}
   - Si 401 → clear tokens + cache et {user:null}
============================================================ */
export async function me(options = {}) {
  const force = options?.force === true;
  const maxAgeMs = resolveMeCacheTtlMs(options?.maxAgeMs);

  if (!force) {
    const cachedUser = readFreshCachedUser(maxAgeMs);
    if (cachedUser && hasSessionForMeCache()) {
      syncLanguageFromUser(cachedUser);
      return { user: cachedUser, cached: true };
    }

    if (meRequestPromise) {
      return meRequestPromise;
    }
  }

  const request = (async () => {
  if (!shouldUseLocalStorage()) {
    try {
      const { data } = await api.get('/auth/me', {
        skipAuthRedirect: true,
        silentAuth: true,
      });
      syncCsrfToken(data);
      if (data?.user) {
        writeCachedUser(data.user);
        syncLanguageFromUser(data.user);
      }
      return data;
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        // En mode cookie, un Bearer stale peut ecraser une session cookie valide.
        // On tente une seule fois sans header si le cookie CSRF existe.
        if (hasCookie(CSRF_COOKIE)) {
          try {
            const { data } = await api.get('/auth/me', {
              skipAuthRedirect: true,
              silentAuth: true,
              skipAuthHeader: true,
            });
            syncCsrfToken(data);
            if (data?.user) {
              removeTokenAll(); // purge le Bearer obsolete
              writeCachedUser(data.user);
              syncLanguageFromUser(data.user);
              return data;
            }
          } catch {
            // fallback vers purge standard
          }
        }
        if (readRefreshToken()) {
          try {
            await refreshWithStoredRefreshToken();
            const { data } = await api.get('/auth/me', {
              skipAuthRedirect: true,
              silentAuth: true,
            });
            syncCsrfToken(data);
            if (data?.user) {
              writeCachedUser(data.user);
              syncLanguageFromUser(data.user);
              return data;
            }
          } catch {
            // fallback vers purge standard
          }
        }
        // Nettoyage complet si token/cookie invalide
        removeTokenAll();
        clearCsrfToken();
        writeCachedUser(null);
        return { user: null };
      }

      const isNetworkError = !error?.response;
      if (isNetworkError) {
        const cached = readCachedUser();
        if (cached) {
          syncLanguageFromUser(cached);
          console.warn('AuthService backend unavailable warning:', 'using cached user (offline mode)');
          return { user: cached, offline: true };
        }
        console.warn('AuthService /auth/me backend connection warning:', error?.message || error);
        return { user: null };
      }

      console.warn('AuthService /auth/me warning:', {
        status,
        data: error?.response?.data,
        msg: error?.message,
      });

      const cached = readCachedUser();
      if (cached) {
        syncLanguageFromUser(cached);
        return { user: cached, offline: true };
      }

      return { user: null };
    }
  }

  const token = readTokenAny();

  // Pas de token => tentative via cookie (utile si auth en mode cookie)
  if (!token) {
    if (readRefreshToken()) {
      try {
        await refreshWithStoredRefreshToken();
        const { data } = await api.get('/auth/me', {
          skipAuthRedirect: true,
          silentAuth: true,
        });
        syncCsrfToken(data);
        if (data?.user) {
          writeCachedUser(data.user);
          syncLanguageFromUser(data.user);
          return data;
        }
      } catch {
        // on retombe sur les autres heuristiques
      }
    }

    const hasCsrf = hasCookie(CSRF_COOKIE);
    if (!hasCsrf) {
      const cached = readCachedUser();
      if (cached) writeCachedUser(null);
      return { user: null };
    }

    try {
      const { data } = await api.get('/auth/me', {
        skipAuthRedirect: true,
        silentAuth: true,
      });
      syncCsrfToken(data);
      if (data?.user) {
        writeCachedUser(data.user);
        syncLanguageFromUser(data.user);
        return data;
      }
      return data || { user: null };
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401) {
        clearCookie(CSRF_COOKIE);
        clearCsrfToken();
        writeCachedUser(null);
        return { user: null };
      }

      const isNetworkError = !error?.response;
      if (isNetworkError) {
        const cached = readCachedUser();
        if (cached) {
          syncLanguageFromUser(cached);
          console.warn(
            'AuthService backend unavailable warning: using cached user (offline mode)'
          );
          return { user: cached, offline: true };
        }
        console.warn('AuthService /auth/me backend connection warning:', error?.message || error);
        return { user: null };
      }

      console.warn('AuthService /auth/me without token warning:', {
        status,
        data: error?.response?.data,
        msg: error?.message,
      });
    }

    const cached = readCachedUser();
    if (cached) {
      console.warn('AuthService missing token warning:', 'clearing cached user');
      writeCachedUser(null);
    } else {
      console.warn('AuthService missing token warning:', 'localStorage token not found');
    }
    return { user: null };
  }


  try {
 // /auth/me lintercepteur axios injecte deja Authorization
    const { data } = await api.get('/auth/me', {
      skipAuthRedirect: true,
      silentAuth: true,
    });
    syncCsrfToken(data);

    // Mise à jour du cache local
    if (data?.user) writeCachedUser(data.user);

    return data; // { user }
  } catch (error) {
    const status = error?.response?.status;

 // 401 token invalide/expire : nettoyage total
    if (status === 401) {
      // Cas mixte possible: cookie session valide + Bearer local expiré.
      // Le backend priorise le header Authorization sur le cookie.
      // On tente donc une seule fois /auth/me sans header si le cookie CSRF existe.
      if (hasCookie(CSRF_COOKIE)) {
        try {
          const { data } = await api.get('/auth/me', {
            skipAuthRedirect: true,
            silentAuth: true,
            skipAuthHeader: true,
          });
          syncCsrfToken(data);
          if (data?.user) {
            removeTokenAll(); // purge le Bearer obsolète pour éviter les 401 suivants
            writeCachedUser(data.user);
            syncLanguageFromUser(data.user);
            return data;
          }
        } catch (fallbackError) {
          // si le fallback cookie échoue aussi, on continue la purge standard
        }
      }

      console.warn('AuthService invalid token warning:', 'clearing local auth data');
      removeTokenAll();
      clearCsrfToken();
      writeCachedUser(null);
      return { user: null };
    }

 // Reseau down / backend indisponible : fallback cache
 // axios na pas error.response pour les erreurs reseau
    const isNetworkError = !error?.response;
    if (isNetworkError) {
      const cached = readCachedUser();
      if (cached) {
        console.warn('AuthService backend unavailable warning:', 'using cached user (offline mode)');
        return { user: cached, offline: true };
      }
      console.warn('AuthService /auth/me backend connection warning:', error?.message || error);
      return { user: null };
    }

    // Autres erreurs (4xx, 5xx) — on journalise, on ne casse pas
    console.warn('AuthService /auth/me warning:', {
      status,
      data: error?.response?.data,
      msg: error?.message,
    });

    // On tente aussi le cache si dispo
      const cached = readCachedUser();
      if (cached) {
        syncLanguageFromUser(cached);
        return { user: cached, offline: true };
      }

    return { user: null };
  }
  })();

  meRequestPromise = request;

  try {
    return await request;
  } finally {
    if (meRequestPromise === request) {
      meRequestPromise = null;
    }
  }
}

/* ============================================================
   🔐 Mot de passe oublié (demande de reset)
============================================================ */
export async function forgotPassword(payload) {
  const inProd = (process.env.NODE_ENV || 'development') === 'production';
  const debugSuffix = inProd ? '' : '?debug=true';
  const { data } = await api.post(`/auth/forgot-password${debugSuffix}`, payload);
  return data;
}

/* ============================================================
   🔁 Reset mot de passe (token)
============================================================ */
export async function resetPassword(payload) {
  const { data } = await api.post('/auth/reset-password', payload);
  return data;
}

export async function recoverWithCode(payload) {
  const { data } = await api.post('/auth/recover-with-code', payload);
  return data;
}

/* ============================================================
   🔐 Changer mot de passe (auth)
============================================================ */
export async function changePassword(payload) {
  const { data } = await api.post('/auth/change-password', payload);
  return data;
}

export async function regenerateRecoveryCodes(payload) {
  const { data } = await api.post('/auth/recovery-codes/regenerate', payload);
  return data;
}

/* ============================================================
   🔹 Déconnexion (logout)
   - Nettoie toutes les données locales (nouvelle + legacy key)
============================================================ */
export async function logout() {
  try {
    await api.post(
      '/auth/logout',
      {
        refreshToken: readRefreshToken() || undefined,
      },
      { skipAuthRedirect: true, silentAuth: true }
    );
  } catch (e) {
    // Even if server-side logout fails, clear local state to avoid stale UI/session.
  }

  try {
    removeTokenAll();
    clearCsrfToken();
    writeCachedUser(null);
  } catch (e) {
    console.warn('AuthService clear local data warning:', e);
  }
}

/* ============================================================
   🌐 Mettre a jour la langue (profil)
============================================================ */
export async function updateMyLanguage(language) {
  const { data } = await api.patch('/auth/me', { language });
  if (data?.user) {
    writeCachedUser(data.user);
    syncLanguageFromUser(data.user);
  }
  return data?.user;
}

/* ============================================================
   🔹 Utilitaires publics
============================================================ */

/** Recupere lutilisateur local (offline) sans requete reseau. */
export function getLocalUser() {
  return readCachedUser();
}

/** Met a jour le user local (offline) */
export function setLocalUser(patch) {
  const current = readCachedUser() || {};
  const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
  writeCachedUser(next, { verifiedAt: readCachedUserSyncedAt() });
  return next;
}

/** Recupere le token (nouveau ou legacy). */
export function getToken() {
  return readTokenAny();
}

export function getAuthHeader() {
  if (isCookieAuthMode() && !isCookieBearerFallbackEnabled()) return {};
  const token = readTokenFromStorage();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function hasSessionHint() {
  if (isCookieAuthMode()) {
    return (
      Boolean(readCachedUser()) ||
      hasCookieSessionHint() ||
      Boolean(readTokenAny()) ||
      Boolean(readRefreshToken())
    );
  }
  return Boolean(readTokenAny()) || Boolean(readRefreshToken());
}

export function usesCookieAuth() {
  return isCookieAuthMode();
}

export function usesCookieBearerFallback() {
  return isCookieBearerFallbackEnabled();
}

/* ============================================================
   🔹 Export par défaut groupé (interop + compat)
============================================================ */
const AuthService = {
  register,
  login,
  forgotPassword,
  resetPassword,
  recoverWithCode,
  changePassword,
  regenerateRecoveryCodes,
  me,
  logout,
  updateMyLanguage,
  getLocalUser,
  setLocalUser,
  getToken,
  getAuthHeader,
  hasSessionHint,
  usesCookieAuth,
  usesCookieBearerFallback,
};

export default AuthService;

