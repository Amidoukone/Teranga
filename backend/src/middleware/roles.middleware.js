'use strict';

/**
 * Middleware d'autorisations par rôles pour Teranga.
 *
 * Règles fondamentales :
 * - Rôles techniques STRICTS :
 *   'client' | 'agent' | 'admin'
 *
 * - MASTER = admin AVEC scope (countryId ou regionId)
 * - ADMIN GLOBAL = admin SANS scope
 *
 * 👉 "master" n'est PAS un rôle, mais un statut logique.
 */

const VALID_ROLES = new Set(['client', 'agent', 'admin']);

/* =========================================================
   🔧 Helpers internes (non cassants)
========================================================= */
function getUser(reqOrUser) {
  return reqOrUser?.user ? reqOrUser.user : reqOrUser;
}

function getUserGeoScope(reqOrUser) {
  const u = getUser(reqOrUser);
  return {
    countryId: u?.countryId ?? null,
    regionId: u?.regionId ?? null,
  };
}

/**
 * Admin global = admin sans scope
 */
function isGlobalAdmin(reqOrUser) {
  const u = getUser(reqOrUser);
  if (u?.role !== 'admin') return false;

  const { countryId, regionId } = getUserGeoScope(u);
  return countryId == null && regionId == null;
}

/**
 * Master = admin avec scope
 */
function isMasterAdmin(reqOrUser) {
  const u = getUser(reqOrUser);
  if (u?.role !== 'admin') return false;

  const { countryId, regionId } = getUserGeoScope(u);
  return countryId != null || regionId != null;
}

/* =========================================================
   ✅ requireRoles (INCHANGÉ)
========================================================= */
function requireRoles(...allowedRoles) {
  const normalized = allowedRoles.filter((r) => VALID_ROLES.has(r));

  if (normalized.length === 0) {
    throw new Error(
      'roles.middleware: requireRoles() appelé sans rôle valide.'
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
   ✅ requireSelfOrRoles (INCHANGÉ)
========================================================= */
function requireSelfOrRoles(paramKey = 'id', ...allowedRoles) {
  const normalized = allowedRoles.filter((r) => VALID_ROLES.has(r));

  if (normalized.length === 0) {
    throw new Error(
      'roles.middleware: requireSelfOrRoles() appelé sans rôle valide.'
    );
  }

  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user?.role) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const isSelf =
        String(req.params?.[paramKey]) === String(user.id);
      if (isSelf) return next();

      if (normalized.includes(user.role)) return next();

      return res.status(403).json({ error: 'Accès interdit' });
    } catch (err) {
      next(err);
    }
  };
}

/* =========================================================
   🛡️ NOUVEAU — requireGlobalAdmin
========================================================= */
/**
 * Autorise UNIQUEMENT un ADMIN GLOBAL.
 * 👉 À utiliser pour :
 * - création admin
 * - promotion admin
 * - gestion masters
 */
function requireGlobalAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  if (!isGlobalAdmin(req)) {
    return res.status(403).json({
      error: 'Action réservée à un administrateur global',
    });
  }

  next();
}

/* =========================================================
   ✅ Raccourcis existants
========================================================= */
const requireAdmin = requireRoles('admin');
const requireAgent = requireRoles('agent');
const requireClient = requireRoles('client');

module.exports = {
  // Middlewares
  requireRoles,
  requireSelfOrRoles,
  requireGlobalAdmin,

  // Raccourcis
  requireAdmin,
  requireAgent,
  requireClient,

  // Helpers (optionnels mais STRATÉGIQUES)
  getUserGeoScope,
  isGlobalAdmin,
  isMasterAdmin,
};
