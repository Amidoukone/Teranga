// backend/src/routes/transaction.routes.js
'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/transaction.controller');
const auth = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/authorization.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const upload = require('../middleware/uploadEvidence.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createTransactionSchema,
  updateTransactionSchema,
} = require('../validators/transaction.schemas');

const NON_REGRESSIVE_VALIDATION_OPTIONS = {
  allowUnknown: true,
  stripUnknown: false,
};

/**
 * ROUTES TRANSACTIONS
 * =========================
 * - Client, agent, admin peuvent consulter/créer/mettre à jour/supprimer
 *   leurs transactions (ACL dans le contrôleur)
 * - Admin : accès aux agrégats (summary/report) (scope appliqué côté ACL)
 *
 * Conventions (cohérence avec orderId) :
 * - GET  /api/transactions?orderId=...   -> liste filtrée par commande (ACL dans contrôleur)
 * - GET  /api/transactions/order/:id     -> alias REST pour lister par commande
 * - POST /api/transactions/order/:id     -> alias REST pour créer une transaction liée à une commande
 *
 * IMPORTANT (upload preuve paiement) :
 * - Pour éviter "MulterError: Unexpected field" quand le front envoie `proof`, `proofFile`, `file`,
 *   `attachment` ou `files`, on utilise `upload.any()` sur les routes POST/PUT.
 *   Le contrôleur détecte proprement le fichier via extractUploadFile(req).
 */

/* ===================================================================
   🔧 Helpers locaux : sanitation / validation non bloquante
=================================================================== */
function toSafeInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// Injecte proprement req.body.orderId depuis :id (si valide)
function injectOrderIdFromParam(req, _res, next) {
  const id = toSafeInt(req.params.id);
  if (id) {
    req.body = req.body || {};
    req.body.orderId = id; // cohérent avec le contrôleur qui lit req.body.orderId
  }
  next();
}

// Mappe l’alias /order/:id vers req.query.orderId pour la liste
function injectOrderIdQuery(req, _res, next) {
  const id = toSafeInt(req.params.id);
  if (id) {
    req.query = req.query || {};
    req.query.orderId = id; // cohérent avec ctrl.list qui supporte ?orderId=
  }
  next();
}

/* ===================================================================
   🧮 ADMIN : agrégats
=================================================================== */
router.get('/summary', auth, requirePermission(PERMISSIONS.FINANCE_REPORT), ctrl.summary);
router.get('/report', auth, requirePermission(PERMISSIONS.FINANCE_REPORT), ctrl.report);

/* ===================================================================
   📖 LECTURE
=================================================================== */
router.get(
  '/',
  auth,
  requirePermission(PERMISSIONS.FINANCE_TRANSACTION_ACCESS),
  ctrl.list
);

// Détail d’une transaction
router.get(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.FINANCE_TRANSACTION_ACCESS),
  ctrl.detail
);

/* ===================================================================
   ✍️ CRÉATION / 🔁 MISE À JOUR / 🗑️ SUPPRESSION
=================================================================== */
router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.FINANCE_TRANSACTION_ACCESS),
  upload.any(), // ✅ tolérant aux différents noms de champ fichier
  validateBody(createTransactionSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.create
);

router.put(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.FINANCE_TRANSACTION_ACCESS),
  upload.any(), // ✅ idem pour la mise à jour
  validateBody(updateTransactionSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.update
);

router.delete(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.FINANCE_TRANSACTION_DELETE),
  ctrl.remove
);

/* ===================================================================
   🔗 ALIAS REST LIÉS AUX COMMANDES (orderId)
=================================================================== */

// Lister les transactions d'une commande (alias REST)
router.get(
  '/order/:id',
  auth,
  requirePermission(PERMISSIONS.FINANCE_TRANSACTION_ACCESS),
  injectOrderIdQuery,
  ctrl.list
);

// Créer une transaction directement sous une commande (alias REST)
router.post(
  '/order/:id',
  auth,
  requirePermission(PERMISSIONS.FINANCE_TRANSACTION_ACCESS),
  upload.any(),
  validateBody(createTransactionSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  injectOrderIdFromParam, // ⚠️ après multer si besoin (ici ok, multer remplit req.body mais on force orderId)
  ctrl.create
);

module.exports = router;
