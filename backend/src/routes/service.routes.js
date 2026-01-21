// backend/src/routes/service.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/service.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

/**
 * ROUTES SERVICES
 * =========================
 * - Admin  : gérer tous les services, assigner des agents
 * - Master : gérer services dans son scope (filtré côté controller/service)
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
   👑 ADMIN / MASTER
====================================================== */

// 🔹 Liste tous les services (admin global + master scoped)
router.get('/', auth, requireRoles('admin', 'master'), useHandler('listAll'));

// 🔹 Assigner un agent à un service
router.post('/assign', auth, requireRoles('admin', 'master'), useHandler('assignAgent'));

// 🔹 Mettre à jour un service (admin/master + client propriétaire)
router.put('/:id', auth, requireRoles('admin', 'master', 'client'), useHandler('updateService'));

// 🔹 Supprimer un service (admin/master + client propriétaire)
router.delete('/:id', auth, requireRoles('admin', 'master', 'client'), useHandler('deleteService'));

/* ======================================================
   👤 CLIENT & ADMIN/MASTER
====================================================== */

// 🔹 Créer un service
router.post('/', auth, requireRoles('client', 'admin', 'master'), useHandler('create'));

// 🔹 Liste des services du client connecté
router.get('/me', auth, requireRoles('client', 'admin', 'master'), useHandler('listClient'));

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
