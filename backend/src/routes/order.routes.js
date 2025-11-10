// backend/src/routes/order.routes.js
'use strict';

const express = require('express');

// Router principal pour /api/orders
const router = express.Router();

const ctrl = require('../controllers/order.controller');
const evidenceCtrl = require('../controllers/evidence.controller');

const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

// 🔗 Sous-routeur items (imbriqué) — corrige les 404 /orders/:orderId/items
//   -> fourni par backend/src/routes/orderItem.routes.js (export .nested)
const { nested: orderItemsRouter } = require('./orderItem.routes');

// 🧰 Multer configuré centralement pour les preuves
// - destination: /uploads/evidences (servi publiquement)
// - champs acceptés: "files" (canon) + compat "proofFile", "proof"
// - expose: anyCompat(), array('files', n), single('...') (compat)
const uploadEvidence = require('../middleware/uploadEvidence.middleware');

/* =====================================================================
   ✅ Routes CRUD de base (inchangées)
===================================================================== */
router.post('/', auth, requireRoles('admin', 'client'), ctrl.create);
router.get('/', auth, requireRoles('admin', 'agent', 'client'), ctrl.list);
router.get('/:id', auth, requireRoles('admin', 'agent', 'client'), ctrl.detail);
router.put('/:id', auth, requireRoles('admin', 'client'), ctrl.update);
router.delete('/:id', auth, requireRoles('admin', 'client'), ctrl.remove);

/* =====================================================================
   🧩 Routes imbriquées — Items de commande
   Monte toutes les routes items sous /api/orders/:orderId/items
   (POST, GET, PUT/:id, DELETE/:id) — déjà ACL dans requireRoles + contrôleur
===================================================================== */
router.use('/:orderId/items', orderItemsRouter);

/* =====================================================================
   📎 Routes imbriquées — Evidences (preuves) de commande
   - GET  /api/orders/:orderId/evidences           -> liste
   - POST /api/orders/:orderId/evidences           -> upload de 1..N fichiers
   - DELETE /api/orders/:orderId/evidences/:id     -> suppression d’une preuve
===================================================================== */

/**
 * Mappe proprement :orderId -> req.params.id
 * evidenceCtrl.listByOrder lit req.params.id en interne.
 */
function mapOrderParamToId(req, _res, next) {
  if (req.params && req.params.orderId != null) {
    req.params.id = req.params.orderId; // normalisation attendue par le contrôleur
  }
  next();
}

/**
 * Injecte req.body.orderId depuis :orderId.
 * ⚠️ IMPORTANT: à placer APRES multer (car multer réécrit req.body).
 */
function injectOrderIdFromParams(req, _res, next) {
  if (req.params && req.params.orderId != null) {
    req.body = req.body || {};
    if (req.body.orderId == null) {
      req.body.orderId = req.params.orderId;
    }
  }
  next();
}

// -- Endpoints evidences ----------------------------------------------
router.get(
  '/:orderId/evidences',
  auth,
  requireRoles('client', 'agent', 'admin'),
  mapOrderParamToId,
  evidenceCtrl.listByOrder
);

router.post(
  '/:orderId/evidences',
  auth,
  requireRoles('client', 'agent', 'admin'),
  // ✅ Accepte 'files' (canon) + 'proofFile'/'proof' (legacy), évite "Unexpected field"
  uploadEvidence.anyCompat(),
  // ⚠️ Injecter orderId APRÈS multer pour ne pas être écrasé
  injectOrderIdFromParams,
  evidenceCtrl.create
);

router.delete(
  '/:orderId/evidences/:id',
  auth,
  // suppression: réservée à admin pour rester cohérent avec evidence.routes.js
  requireRoles('admin'),
  evidenceCtrl.remove
);

module.exports = router;
