// backend/src/routes/user.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles, isGlobalAdmin } = require('../middleware/roles.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createUserSchema,
  updateUserSchema,
  createAgentSchema,
} = require('../validators/user.schemas');

/**
 * Routes liées aux utilisateurs
 * - Les clients créent leur compte publiquement via /api/auth/register
 * - Les admins peuvent gérer tous les utilisateurs (CRUD)
 * - Les admins scoped (MASTER) sont limités par scope côté controller/service
 *
 * ✅ Sécurité 2026 (defense-in-depth) :
 * - Route guard "admin global only" quand l'intention est de créer/passer un user en admin
 * - Le controller reste la source de vérité (anti-Postman/anti-DOM hack)
 */

/* =========================================================
   🔒 Helpers route-level (non cassants)
========================================================= */
function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Autorise uniquement l'admin global.
 * - Utilise roles.middleware.isGlobalAdmin (basé sur req.user injecté par auth)
 */
function requireGlobalAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès interdit' });
  }
  if (!isGlobalAdmin(req.user)) {
    return res.status(403).json({ error: 'Réservé à l’administrateur global' });
  }
  return next();
}

/**
 * Bloque si un MASTER tente de créer/modifier en "admin".
 * - Si role demandé === admin => requireGlobalAdmin
 * - Sinon => next()
 */
function requireGlobalAdminIfTargetRoleAdmin(req, res, next) {
  const targetRole = normalizeRole(req.body?.role);
  if (targetRole === 'admin') {
    return requireGlobalAdmin(req, res, next);
  }
  return next();
}

/* =========================================================
   ✅ Routes statiques (AVANT /:id)
========================================================= */

// ✅ Profil utilisateur connecté (⚠️ DOIT être AVANT "/:id")
router.get('/me', auth, ctrl.me);

/* =========================================================
   🔒 ADMIN : LIST + CREATE
========================================================= */

// Liste par rôle (admin only) — scope géré dans ctrl
router.get('/', auth, requireRoles('admin'), ctrl.listByRole);

// Création user (admin only)
// 🔒 Si on tente de créer un admin/master => admin global only (route guard + ctrl guard)
router.post(
  '/',
  auth,
  requireRoles('admin'),
  validateBody(createUserSchema),
  requireGlobalAdminIfTargetRoleAdmin,
  ctrl.createUser
);

// Création agent (admin only) — inchangé
router.post(
  '/agents',
  auth,
  requireRoles('admin'),
  validateBody(createAgentSchema),
  ctrl.createAgent
);

/* =========================================================
   🔒 ADMIN : READ / UPDATE / DELETE
   (ctrl applique scope + blocage admin/master)
========================================================= */

// ⚠️ Routes paramétrées APRÈS les routes statiques (/me, /agents)
router.get('/:id', auth, requireRoles('admin'), ctrl.getById);

/**
 * Update user
 * 🔒 Si la requête tente de promouvoir en admin => admin global only
 * (la protection “modifier un admin existant” reste côté controller)
 */
router.put(
  '/:id',
  auth,
  requireRoles('admin'),
  validateBody(updateUserSchema),
  requireGlobalAdminIfTargetRoleAdmin,
  ctrl.updateUser
);

/**
 * Delete user
 * ⚠️ Impossible de savoir ici si la cible est admin sans requête DB.
 * => on laisse le controller faire la décision finale (déjà sécurisé).
 * Si tu veux une couche route-level stricte, je peux proposer :
 *   - DELETE /admins/:id (global only)
 *   - DELETE /:id (non-admin only)
 */
router.delete('/:id', auth, requireRoles('admin'), ctrl.deleteUser);

module.exports = router;
