// backend/src/routes/service.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/service.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
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
router.get('/', auth, requireRoles('admin'), useHandler('listAll'));

// 🔹 Assigner un agent à un service
router.post(
  '/assign',
  auth,
  requireRoles('admin'),
  validateBody(assignServiceSchema),
  useHandler('assignAgent')
);

// 🔹 Mettre à jour un service (admin + client propriétaire)
router.put(
  '/:id',
  auth,
  requireRoles('admin', 'client'),
  validateBody(updateServiceSchema),
  useHandler('updateService')
);

// 🔹 Supprimer un service (admin + client propriétaire)
router.delete('/:id', auth, requireRoles('admin', 'client'), useHandler('deleteService'));

/* ======================================================
   👤 CLIENT & ADMIN
====================================================== */

// 🔹 Créer un service
router.post(
  '/',
  auth,
  requireRoles('client', 'admin'),
  validateBody(createServiceSchema),
  useHandler('create')
);

// 🔹 Liste des services du client connecté
router.get('/me', auth, requireRoles('client', 'admin'), useHandler('listClient'));

/* ======================================================
   ⚙️ AGENT
====================================================== */

// 🔹 Liste des services assignés à un agent
router.get('/agent/services', auth, requireRoles('agent'), useHandler('listAgent'));

// 🔹 Agent démarre un service
router.post('/agent/services/:id/start', auth, requireRoles('agent'), useHandler('startService'));

// 🔹 Agent termine un service
router.post('/agent/services/:id/complete', auth, requireRoles('agent'), useHandler('completeService'));

module.exports = router;
