// backend/src/routes/transaction.routes.js
'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/transaction.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const upload = require('../middleware/uploadEvidence.middleware');

/**
 * ROUTES TRANSACTIONS
 * =========================
 * - Client, agent et admin peuvent consulter/créer/mettre à jour/supprimer leurs transactions
 * - Admin a accès aux agrégats (summary/report)
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
router.get('/summary', auth, requireRoles('admin'), ctrl.summary);
router.get('/report', auth, requireRoles('admin'), ctrl.report);

/* ===================================================================
   📖 LECTURE
   - La route "/" supporte les filtres standards + orderId via query (?orderId=)
=================================================================== */
router.get('/', auth, requireRoles('client', 'agent', 'admin'), ctrl.list);

// Détail d’une transaction
router.get('/:id', auth, requireRoles('client', 'agent', 'admin'), ctrl.detail);

/* ===================================================================
   ✍️ CRÉATION / 🔁 MISE À JOUR / 🗑️ SUPPRESSION
   - Création : peut être liée à serviceId, taskId, orderId
   - Pièce jointe éventuelle "preuve de paiement" (images/pdf) — upload.any()
   - On laisse le contrôleur gérer quel fichier prendre si plusieurs
=================================================================== */
router.post(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  // ✅ Accepte n’importe quel nom de champ fichier (proofFile, proof, file, attachment, files…)
  upload.any(),
  ctrl.create
);

router.put(
  '/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  // ✅ Idem pour la mise à jour
  upload.any(),
  ctrl.update
);

router.delete(
  '/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.remove
);

/* ===================================================================
   🔗 ALIAS REST LIÉS AUX COMMANDES (orderId)
   - GET  /api/transactions/order/:id    -> liste des transactions d’une commande
   - POST /api/transactions/order/:id    -> crée une transaction liée à la commande :id
=================================================================== */

// Lister les transactions d'une commande (alias REST)
// -> injecte req.query.orderId, réutilise ctrl.list (ACL incluse)
router.get(
  '/order/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  injectOrderIdQuery,
  ctrl.list
);

// Créer une transaction directement sous une commande (alias REST)
// -> injecte req.body.orderId = :id, puis réutilise toute la logique de ctrl.create
router.post(
  '/order/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  upload.any(),          // ✅ tolérant aux différents noms de champ fichier
  injectOrderIdFromParam,
  ctrl.create
);

/* ===================================================================
   ✅ Export : Express Router pur (compatible avec le chargeur dynamique)
=================================================================== */
module.exports = router;
