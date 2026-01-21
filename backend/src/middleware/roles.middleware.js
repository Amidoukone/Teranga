// backend/src/middleware/roles.middleware.js
'use strict';

/**
 * Middleware d'autorisations par rôles pour Teranga.
 *
 * Hypothèses :
 * - Le middleware d'authentification (auth.middleware) a déjà validé le JWT
 *   et placé l'objet utilisateur dans req.user = { id, role, countryId?, regionId? }.
 *
 * IMPORTANT :
 * - Les rôles techniques restent STRICTEMENT :
 *   'client' | 'agent' | 'admin'
 * - Le concept de "master" est un STATUT LOGIQUE :
 *   admin + scope géographique (countryId / regionId)
 *   → il n'est PAS un rôle.
 *   → il n'est PAS géré ici (il est géré via les filtres/ACL côté services/controllers).
 *
 * ✅ Objectif : garder 100% rétro-compatible, sans régression.
 * ✅ Ajout : helper "isGlobalAdmin" exposé (optionnel), utile dans l'app.
 */

const VALID_ROLES = new Set(['client', 'agent', 'admin']);

/* =========================================================
   🔧 Helpers (non cassants)
========================================================= */
function getUserGeoScope(reqOrUser) {
  const u = reqOrUser?.user ? reqOrUser.user : reqOrUser;
  return {
    countryId: u?.countryId ?? null,
    regionId: u?.regionId ?? null,
  };
}

/**
 * Admin global = admin sans scope (countryId=null ET regionId=null)
 * Master = admin avec scope (countryId!=null OU regionId!=null)
 */
function isGlobalAdmin(reqOrUser) {
  const u = reqOrUser?.user ? reqOrUser.user : reqOrUser;
  if (u?.role !== 'admin') return false;
  const { countryId, regionId } = getUserGeoScope(u);
  return countryId == null && regionId == null;
}

/* =========================================================
   ✅ requireRoles
========================================================= */
/**
 * Vérifie que l'utilisateur connecté possède au moins un des rôles autorisés.
 * @param  {...'client'|'agent'|'admin'} allowedRoles
 * @returns Express middleware
 */
function requireRoles(...allowedRoles) {
  const normalized = allowedRoles.filter((r) => VALID_ROLES.has(r));

  if (normalized.length === 0) {
    // Erreur de configuration côté code (dev)
    throw new Error(
      'roles.middleware: requireRoles() appelé sans rôle valide. ' +
        'Utilise: requireRoles("client"|"agent"|"admin", ...)'
    );
  }

  return (req, res, next) => {
    try {
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      if (!normalized.includes(userRole)) {
        return res.status(403).json({ error: 'Accès interdit' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/* =========================================================
   ✅ requireSelfOrRoles
========================================================= */
/**
 * Autorise si l'utilisateur est "propriétaire" (paramètre de route)
 * OU possède un rôle parmi ceux autorisés (ex: admin).
 *
 * Exemple :
 *   router.get('/users/:id', auth, requireSelfOrRoles('id', 'admin'), ctrl.getUserProfile);
 *
 * @param {string} paramKey - Nom du paramètre de route (ex: 'id')
 * @param  {...'client'|'agent'|'admin'} allowedRoles
 * @returns Express middleware
 */
function requireSelfOrRoles(paramKey = 'id', ...allowedRoles) {
  const normalized = allowedRoles.filter((r) => VALID_ROLES.has(r));

  if (normalized.length === 0) {
    throw new Error(
      'roles.middleware: requireSelfOrRoles() appelé sans rôle valide. ' +
        'Utilise: requireSelfOrRoles("id", "admin") par ex.'
    );
  }

  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user?.role) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const isSelf = String(req.params?.[paramKey]) === String(user.id);
      if (isSelf) return next();

      if (normalized.includes(user.role)) return next();

      return res.status(403).json({ error: 'Accès interdit' });
    } catch (err) {
      next(err);
    }
  };
}

/* =========================================================
   ✅ Raccourcis pratiques (inchangés)
========================================================= */
const requireAdmin = requireRoles('admin');
const requireAgent = requireRoles('agent');
const requireClient = requireRoles('client');

module.exports = {
  requireRoles,
  requireSelfOrRoles,
  requireAdmin,
  requireAgent,
  requireClient,

  // Helpers optionnels (non utilisés si tu ne les importes pas)
  getUserGeoScope,
  isGlobalAdmin,
};
