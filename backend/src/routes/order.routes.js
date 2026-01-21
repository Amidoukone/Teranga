// backend/src/routes/order.routes.js
'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/order.controller');
const evidenceCtrl = require('../controllers/evidence.controller');

const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

const { nested: orderItemsRouter } = require('./orderItem.routes');
const uploadEvidence = require('../middleware/uploadEvidence.middleware');

/* =====================================================================
   ✅ Routes CRUD de base (inchangées + master ajouté)
===================================================================== */
router.post('/', auth, requireRoles('admin', 'master', 'client'), ctrl.create);
router.get('/', auth, requireRoles('admin', 'master', 'agent', 'client'), ctrl.list);
router.get('/:id', auth, requireRoles('admin', 'master', 'agent', 'client'), ctrl.detail);
router.put('/:id', auth, requireRoles('admin', 'master', 'client'), ctrl.update);
router.delete('/:id', auth, requireRoles('admin', 'master', 'client'), ctrl.remove);

/* =====================================================================
   🧩 Routes imbriquées — Items de commande
===================================================================== */
router.use('/:orderId/items', orderItemsRouter);

/* =====================================================================
   📎 Routes imbriquées — Evidences (preuves) de commande
===================================================================== */
function mapOrderParamToId(req, _res, next) {
  if (req.params && req.params.orderId != null) {
    req.params.id = req.params.orderId;
  }
  next();
}

function injectOrderIdFromParams(req, _res, next) {
  if (req.params && req.params.orderId != null) {
    req.body = req.body || {};
    if (req.body.orderId == null) {
      req.body.orderId = req.params.orderId;
    }
  }
  next();
}

router.get(
  '/:orderId/evidences',
  auth,
  requireRoles('client', 'agent', 'admin', 'master'),
  mapOrderParamToId,
  evidenceCtrl.listByOrder
);

router.post(
  '/:orderId/evidences',
  auth,
  requireRoles('client', 'agent', 'admin', 'master'),
  uploadEvidence.anyCompat(),
  injectOrderIdFromParams,
  evidenceCtrl.create
);

router.delete(
  '/:orderId/evidences/:id',
  auth,
  requireRoles('admin'),
  evidenceCtrl.remove
);

module.exports = router;
