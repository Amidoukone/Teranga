// backend/src/middleware/roles.middleware.js

/**
 * Middleware d'autorisations par rôles pour Teranga.
 *
 * Hypothèses :
 * - Le middleware d'authentification (auth.middleware) a déjà validé le JWT
 *   et placé l'objet utilisateur dans req.user = { id, role, ... }.
 *
 * Exemples d'usage :
 *   const auth = require('./auth.middleware');
 *   const { requireRoles, requireAdmin, requireSelfOrRoles } = require('./roles.middleware');
 *
 *   // Route réservée aux admins :
 *   router.post('/agents', auth, requireAdmin, ctrl.createAgent);
 *
 *   // Route accessible aux agents et admins :
 *   router.get('/secure', auth, requireRoles('agent', 'admin'), ctrl.secureEndpoint);
 *
 *   // Route accessible au propriétaire de la ressource OU à un admin :
 *   // (ex : /users/:id, paramKey = 'id')
 *   router.get('/users/:id', auth, requireSelfOrRoles('id', 'admin'), ctrl.getUserProfile);
 */

const VALID_ROLES = new Set(['client', 'agent', 'admin']);

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

/**
 * Autorise si l'utilisateur est "propriétaire" (paramètre de route) OU possède
 * un rôle parmi ceux autorisés (ex: admin). Utile pour /users/:id, /properties/:id, etc.
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

// Raccourcis pratiques
const requireAdmin = requireRoles('admin');
const requireAgent = requireRoles('agent');
const requireClient = requireRoles('client');

module.exports = {
  requireRoles,
  requireSelfOrRoles,
  requireAdmin,
  requireAgent,
  requireClient,
};
