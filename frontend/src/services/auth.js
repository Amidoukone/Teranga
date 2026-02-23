// frontend/src/services/auth.js
import api from './api';
import { setLanguage, normalizeLanguage } from '../i18n';

/**
 * ============================================================
 * 🧩 Module Authentification Teranga (Frontend) — Version robuste
 * ============================================================
 * - Stockage tolérant (migration de l'ancien 'token' -> 'teranga_token')
 * - Résilience réseau : /auth/me ne casse pas l'app en cas d'indispo
 * - Fallback « offline » sur l'utilisateur en cache local
 * - API inchangée pour le reste de l'app (register/login/me/logout/…)
 * ============================================================
 */

const TOKEN_KEY = 'teranga_token';
const LEGACY_TOKEN_KEYS = ['token']; // compat héritée
const USER_KEY = 'teranga_user';
const CSRF_TOKEN_KEY = 'teranga_csrf_token';
const CSRF_COOKIE = 'teranga_csrf';
const AUTH_STORAGE_MODE = (process.env.REACT_APP_AUTH_STORAGE || 'localstorage')
  .toLowerCase()
  .trim();

function shouldUseLocalStorage() {
  return AUTH_STORAGE_MODE !== 'cookie';
}

/* ============================================================
   🔧 Utilitaires internes (robustes)
============================================================ */

/** Retourne le token depuis le nouveau key OU les anciens (puis migre). */
function readTokenAny() {
  if (!shouldUseLocalStorage()) return null;
  // 1) Nouveau nom (préféré)
  const current = safeGet(TOKEN_KEY);
  if (current) return current;

  // 2) Anciennes clés (migration)
  for (const k of LEGACY_TOKEN_KEYS) {
    const legacy = safeGet(k);
    if (legacy) {
      // migration silencieuse
      safeSet(TOKEN_KEY, legacy);
      // On ne supprime pas la legacy tout de suite pour éviter une race condition
      return legacy;
    }
  }
  return null;
}

/** Écrit le token dans la nouvelle clé + (optionnel) legacy pour compat. */
function writeTokenAll(token, { keepLegacy = true } = {}) {
  if (!shouldUseLocalStorage()) return;
  safeSet(TOKEN_KEY, token);
  if (keepLegacy) {
    for (const k of LEGACY_TOKEN_KEYS) safeSet(k, token);
  }
}

/** Supprime le token de toutes les clés. */
function removeTokenAll() {
  safeRemove(TOKEN_KEY);
  for (const k of LEGACY_TOKEN_KEYS) safeRemove(k);
}

function writeCsrfToken(token) {
  if (!token) return;
  safeSet(CSRF_TOKEN_KEY, token);
}

function clearCsrfToken() {
  safeRemove(CSRF_TOKEN_KEY);
}

/** Accès localStorage safe (évite exceptions “quota”, “disabled”, SSR…) */
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
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
function writeCachedUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
    notifyAuthChange();
  } catch {
    // noop
  }
}

function syncLanguageFromUser(user) {
  const lang = normalizeLanguage(user?.language);
  if (lang) setLanguage(lang);
}

/* ============================================================
   🔹 Inscription d’un nouvel utilisateur
============================================================ */
export async function register(payload) {
  try {
    const { data } = await api.post('/auth/register', payload);
    return data; // { message, user, token? }
  } catch (error) {
    console.error('❌ Erreur register:', error);
    throw error;
  }
}

/* ============================================================
   🔹 Connexion (login)
   - Stocke le JWT dans localStorage (nouvelle + legacy key)
   - Met en cache le user pour UX immédiate
============================================================ */
export async function login(payload) {
  try {
    const { data } = await api.post('/auth/login', payload);

    if (!data?.token) {
      throw new Error('Token manquant dans la réponse du serveur');
    }

    if (shouldUseLocalStorage()) {
      // ✅ Sauvegarde cohérente du token (nouvelle + legacy pour compat)
      writeTokenAll(data.token, { keepLegacy: true });
    } else {
      // Mode cookie: évite tout token persistant côté client
      removeTokenAll();
    }
    writeCsrfToken(data?.csrfToken);

    // ✅ Cache user pour UX immédiate
    if (data.user) {
      writeCachedUser(data.user);
      syncLanguageFromUser(data.user);
    }

    return data; // { token, user }
  } catch (error) {
    console.error('❌ Erreur login:', error);
    throw error;
  }
}

/* ============================================================
   🔹 Récupérer l’utilisateur courant (/auth/me)
   - Si pas de token => session invalide : {user:null} (+ purge cache)
   - Si réseau KO → renvoie le user caché (si dispo) sinon {user:null}
   - Si 401 → clear tokens + cache et {user:null}
============================================================ */
export async function me() {
  if (!shouldUseLocalStorage()) {
    try {
      const { data } = await api.get('/auth/me', {
        skipAuthRedirect: true,
        silentAuth: true,
      });
      if (data?.user) {
        writeCachedUser(data.user);
        syncLanguageFromUser(data.user);
      }
      return data;
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        clearCsrfToken();
        writeCachedUser(null);
        return { user: null };
      }

      const isNetworkError = !error?.response;
      if (isNetworkError) {
        const cached = readCachedUser();
        if (cached) {
          syncLanguageFromUser(cached);
          console.warn('⚠️ Backend indisponible — utilisation du user en cache (mode “offline”).');
          return { user: cached, offline: true };
        }
        console.warn('⚠️ Erreur connexion backend /auth/me:', error?.message || error);
        return { user: null };
      }

      console.warn('⚠️ Erreur /auth/me:', {
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
            '⚠️ Backend indisponible — utilisation du user en cache (mode “offline”).'
          );
          return { user: cached, offline: true };
        }
        console.warn('⚠️ Erreur connexion backend /auth/me:', error?.message || error);
        return { user: null };
      }

      console.warn('⚠️ Erreur /auth/me sans token:', {
        status,
        data: error?.response?.data,
        msg: error?.message,
      });
    }

    const cached = readCachedUser();
    if (cached) {
      console.warn('Aucun token detecte - purge du user en cache.');
      writeCachedUser(null);
    } else {
      console.warn('Aucun token trouve (localStorage vide)');
    }
    return { user: null };
  }


  try {
    // ✅ /auth/me — l’intercepteur axios injecte déjà Authorization
    const { data } = await api.get('/auth/me', {
      skipAuthRedirect: true,
      silentAuth: true,
    });

    // Mise à jour du cache local
    if (data?.user) writeCachedUser(data.user);

    return data; // { user }
  } catch (error) {
    const status = error?.response?.status;

    // 401 → token invalide/expiré : nettoyage total
    if (status === 401) {
      console.warn('⚠️ Token invalide ou expiré → suppression locale');
      removeTokenAll();
      clearCsrfToken();
      writeCachedUser(null);
      return { user: null };
    }

    // ❌ Réseau down / backend indisponible : fallback cache
    // axios n’a pas error.response pour les erreurs réseau
    const isNetworkError = !error?.response;
    if (isNetworkError) {
      const cached = readCachedUser();
      if (cached) {
        console.warn('⚠️ Backend indisponible — utilisation du user en cache (mode “offline”).');
        return { user: cached, offline: true };
      }
      console.warn('⚠️ Erreur connexion backend /auth/me:', error?.message || error);
      return { user: null };
    }

    // Autres erreurs (4xx, 5xx) — on journalise, on ne casse pas
    console.warn('⚠️ Erreur /auth/me:', {
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
    await api.post('/auth/logout', {}, { skipAuthRedirect: true, silentAuth: true });
  } catch (e) {
    // Even if server-side logout fails, clear local state to avoid stale UI/session.
  }

  try {
    removeTokenAll();
    clearCsrfToken();
    writeCachedUser(null);
  } catch (e) {
    console.warn('⚠️ Erreur suppression données locales:', e);
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

/** Récupère l’utilisateur local (offline) sans requête réseau. */
export function getLocalUser() {
  return readCachedUser();
}

/** Met a jour le user local (offline) */
export function setLocalUser(patch) {
  const current = readCachedUser() || {};
  const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
  writeCachedUser(next);
  return next;
}

/** Récupère le token (nouveau ou legacy). */
export function getToken() {
  return readTokenAny();
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
};

export default AuthService;
