// backend/src/routes/task.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/task.controller');
const evCtrl = require('../controllers/evidence.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const uploadEvidence = require('../middleware/uploadEvidence.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createTaskSchema,
  updateStatusSchema,
  assignAgentSchema,
} = require('../validators/task.schemas');

// ➕ Créer une tâche (client ou admin)
router.post(
  '/',
  auth,
  requireRoles('client', 'admin'),
  validateBody(createTaskSchema),
  ctrl.create
);

// 📋 Lister les tâches
router.get('/', auth, requireRoles('client', 'agent', 'admin'), ctrl.list);

// 📋 Lister les tâches d’un service
router.get(
  '/service/:serviceId',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByService
);

// 🔄 Mettre à jour le statut d’une tâche
router.put(
  '/:id/status',
  auth,
  requireRoles('agent', 'admin'),
  validateBody(updateStatusSchema),
  ctrl.updateStatus
);

// 🧩 Assigner une tâche à un agent (admin)
router.put(
  '/:id/assign',
  auth,
  requireRoles('admin'),
  validateBody(assignAgentSchema),
  ctrl.assignAgent
);

// ✅ Alias "evidences" pour preuves liées à une tâche

// Récupérer les preuves d'une tâche
router.get(
  '/:id/evidences',
  auth,
  requireRoles('client', 'agent', 'admin'),
  evCtrl.listByTask
);

// Ajouter des preuves à une tâche
router.post(
  '/:id/evidences',
  auth,
  requireRoles('client', 'agent', 'admin'),
  uploadEvidence.anyCompat(),
  (req, _res, next) => {
    req.body = req.body || {};
    req.body.taskId = req.params.id;
    next();
  },
  evCtrl.create
);

module.exports = router;
