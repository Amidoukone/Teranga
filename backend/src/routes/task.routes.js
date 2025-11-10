'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/task.controller');
const evCtrl = require('../controllers/evidence.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const uploadEvidence = require('../middleware/uploadEvidence.middleware');

// ➕ Créer une tâche (client ou admin)
router.post('/', auth, requireRoles('client', 'admin'), ctrl.create);

// 📋 Lister les tâches
router.get('/', auth, requireRoles('client', 'agent', 'admin'), ctrl.list);

// 📋 Lister les tâches d’un service
router.get('/service/:serviceId', auth, requireRoles('client', 'agent', 'admin'), ctrl.listByService);

// 🔄 Mettre à jour le statut d’une tâche
router.put('/:id/status', auth, requireRoles('agent', 'admin'), ctrl.updateStatus);

// 🧩 Nouveau : assigner une tâche à un agent (admin uniquement)
router.put('/:id/assign', auth, requireRoles('admin'), ctrl.assignAgent);

// ✅ Alias "evidences" pour gestion des preuves liées à une tâche
router.get('/:id/evidences', auth, requireRoles('client', 'agent', 'admin'), evCtrl.listByTask);

router.post(
  '/:id/evidences',
  auth,
  requireRoles('client', 'agent', 'admin'),
  uploadEvidence.array('files', 10),
  (req, res, next) => {
    req.body = req.body || {};
    req.body.taskId = req.params.id;
    return evCtrl.create(req, res, next);
  }
);

module.exports = router;
