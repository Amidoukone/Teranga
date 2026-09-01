// backend/src/routes/service.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/service.controller');
const auth = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/authorization.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createServiceSchema,
  updateServiceSchema,
  assignServiceSchema,
} = require('../validators/service.schemas');

/**
 * ROUTES SERVICES
 * =========================
 * - Admin  : gérer tous les services, assigner des agents
 * - Admin scoped : gérer services dans son scope (filtré côté controller/service)
 * - Client : gérer ses services
 * - Agent  : voir et exécuter ses services assignés
 */

// Petit helper pour s'assurer que chaque handler existe
function useHandler(name) {
  const fn = ctrl?.[name];
  if (typeof fn !== 'function') {
    const keys = ctrl && typeof ctrl === 'object' ? Object.keys(ctrl) : [];
    throw new Error(
      `[service.routes] Handler introuvable: ctrl.${name}.\n` +
      `Exports disponibles: ${JSON.stringify(keys)}`
    );
  }
  return fn;
}

/* ======================================================
   👑 ADMIN
====================================================== */

// 🔹 Liste tous les services (admin global + admin scoped)
router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.SERVICE_ADMIN_LIST),
  useHandler('listAll')
);

// 🔹 Assigner un agent à un service
router.post(
  '/assign',
  auth,
  requirePermission(PERMISSIONS.SERVICE_ASSIGN),
  validateBody(assignServiceSchema),
  useHandler('assignAgent')
);

// 🔹 Mettre à jour un service (admin + client propriétaire)
router.put(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.SERVICE_UPDATE),
  validateBody(updateServiceSchema),
  useHandler('updateService')
);

// 🔹 Supprimer un service (admin + client propriétaire)
router.delete(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.SERVICE_DELETE),
  useHandler('deleteService')
);

/* ======================================================
   👤 CLIENT & ADMIN
====================================================== */

// 🔹 Créer un service
router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.SERVICE_CREATE),
  validateBody(createServiceSchema),
  useHandler('create')
);

// 🔹 Liste des services du client connecté
router.get(
  '/me',
  auth,
  requirePermission(PERMISSIONS.SERVICE_CLIENT_LIST),
  useHandler('listClient')
);

/* ======================================================
   ⚙️ AGENT
====================================================== */

// 🔹 Liste des services assignés à un agent
router.get(
  '/agent/services',
  auth,
  requirePermission(PERMISSIONS.SERVICE_AGENT_LIST),
  useHandler('listAgent')
);

// 🔹 Agent démarre un service
router.post(
  '/agent/services/:id/start',
  auth,
  requirePermission(PERMISSIONS.SERVICE_AGENT_EXECUTE),
  useHandler('startService')
);

// 🔹 Agent termine un service
router.post(
  '/agent/services/:id/complete',
  auth,
  requirePermission(PERMISSIONS.SERVICE_AGENT_EXECUTE),
  useHandler('completeService')
);

// Le client confirme en une action que le service classique est termine.
router.post(
  '/:id/validate',
  auth,
  requirePermission(PERMISSIONS.SERVICE_VALIDATE),
  useHandler('validateService')
);

/* ======================================================
   🔎 DÉTAIL (client propriétaire, agent assigné, admin)
   Placé en dernier : "/:id" est un segment générique qui capturerait "/me" s'il était
   enregistré avant lui.
====================================================== */
router.get(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.SERVICE_DETAIL),
  useHandler('getById')
);

module.exports = router;
