// frontend/src/services/auth.js
import api from './api';

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

/* ============================================================
   🔧 Utilitaires internes (robustes)
============================================================ */

/** Retourne le token depuis le nouveau key OU les anciens (puis migre). */
function readTokenAny() {
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
  } catch {
    // noop
  }
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

    // ✅ Sauvegarde cohérente du token (nouvelle + legacy pour compat)
    writeTokenAll(data.token, { keepLegacy: true });

    // ✅ Cache user pour UX immédiate
    if (data.user) writeCachedUser(data.user);

    return data; // { token, user }
  } catch (error) {
    console.error('❌ Erreur login:', error);
    throw error;
  }
}

/* ============================================================
   🔹 Récupérer l’utilisateur courant (/auth/me)
   - Si pas de token → renvoie le user caché (si dispo) sinon {user:null}
   - Si réseau KO → renvoie le user caché (si dispo) sinon {user:null}
   - Si 401 → clear tokens + cache et {user:null}
============================================================ */
export async function me() {
  const token = readTokenAny();

  // 🔸 Pas de token → on tente un fallback user (offline)
  if (!token) {
    const cached = readCachedUser();
    if (cached) {
      console.warn('⚠️ Aucun token, mode “offline” — utilisation du user en cache.');
      return { user: cached, offline: true };
    }
    console.warn('⚠️ Aucun token trouvé (localStorage vide)');
    return { user: null };
  }

  try {
    // ✅ /auth/me — l’intercepteur axios injecte déjà Authorization
    const { data } = await api.get('/auth/me');

    // Mise à jour du cache local
    if (data?.user) writeCachedUser(data.user);

    return data; // { user }
  } catch (error) {
    const status = error?.response?.status;

    // 401 → token invalide/expiré : nettoyage total
    if (status === 401) {
      console.warn('⚠️ Token invalide ou expiré → suppression locale');
      removeTokenAll();
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
    if (cached) return { user: cached, offline: true };

    return { user: null };
  }
}

/* ============================================================
   🔹 Déconnexion (logout)
   - Nettoie toutes les données locales (nouvelle + legacy key)
============================================================ */
export function logout() {
  try {
    removeTokenAll();
    writeCachedUser(null);
  } catch (e) {
    console.warn('⚠️ Erreur suppression données locales:', e);
  }
}

/* ============================================================
   🔹 Utilitaires publics
============================================================ */

/** Récupère l’utilisateur local (offline) sans requête réseau. */
export function getLocalUser() {
  return readCachedUser();
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
  me,
  logout,
  getLocalUser,
  getToken,
};

export default AuthService;
