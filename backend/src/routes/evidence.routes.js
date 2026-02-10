// backend/src/routes/evidence.routes.js
'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/evidence.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { createEvidenceSchema } = require('../validators/evidence.schemas');

const uploadEvidence = require('../middleware/uploadEvidence.middleware');

/* =====================================================================
   ➕ Créer des preuves
===================================================================== */
router.post(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  writeLimiter,
  uploadEvidence.anyCompat(),
  validateBody(createEvidenceSchema),
  ctrl.create
);

/* =====================================================================
   📋 Lister les preuves
===================================================================== */
router.get(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.list
);

/* =====================================================================
   📋 Alias REST — Lister par tâche
===================================================================== */
router.get(
  '/task/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByTask
);

/* =====================================================================
   📋 Alias REST — Lister par commande
===================================================================== */
router.get(
  '/order/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByOrder
);

/* =====================================================================
   ➕ Alias REST — Créer pour une tâche
===================================================================== */
router.post(
  '/task/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  writeLimiter,
  uploadEvidence.anyCompat(),
  (req, _res, next) => {
    req.body = req.body || {};
    req.body.taskId = req.params.id;
    next();
  },
  validateBody(createEvidenceSchema),
  ctrl.create
);

/* =====================================================================
   ➕ Alias REST — Créer pour une commande
===================================================================== */
router.post(
  '/order/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  writeLimiter,
  uploadEvidence.anyCompat(),
  (req, _res, next) => {
    req.body = req.body || {};
    req.body.orderId = req.params.id;
    next();
  },
  validateBody(createEvidenceSchema),
  ctrl.create
);

/* =====================================================================
   ❌ Supprimer une preuve (admin only)
===================================================================== */
router.delete(
  '/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  writeLimiter,
  ctrl.remove
);

module.exports = router;
