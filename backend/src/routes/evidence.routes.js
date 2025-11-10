// backend/src/routes/evidence.routes.js
'use strict';

const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/evidence.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

// 🧰 Multer configuré pour les preuves (config centrale)
// - destination: /uploads/evidences (servi par app.use('/uploads', ...))
// - champs d’upload tolérés: "files", "proofFile", "proof" (compat)
//   via uploadEvidence.anyCompat() (multi-champs sûr)
const uploadEvidence = require('../middleware/uploadEvidence.middleware');

/**
 * ROUTES EVIDENCES
 * =========================
 * Rôles:
 * - Client, agent et admin peuvent ajouter / lister des preuves (contexte requis côté contrôleur)
 * - Admin peut supprimer une preuve (garde-fou rôle côté route, logique fine côté contrôleur)
 *
 * Conventions supportées:
 * - POST /api/evidences                        -> création (body: { taskId? | orderId? }, files: multi-champs)
 * - GET  /api/evidences?taskId=..              -> liste filtrée par tâche (ACL)
 * - GET  /api/evidences?orderId=..             -> liste filtrée par commande (ACL)
 * - GET  /api/evidences/task/:id               -> alias REST liste par tâche
 * - GET  /api/evidences/order/:id              -> alias REST liste par commande
 * - POST /api/evidences/task/:id               -> alias REST création (injecte taskId)
 * - POST /api/evidences/order/:id              -> alias REST création (injecte orderId)
 * - DELETE /api/evidences/:id                  -> suppression (admin)
 *
 * NB: Des routes imbriquées existent aussi côté commandes:
 *     /api/orders/:orderId/evidences
 * (montées dans order.routes.js) pour éviter les 404 côté frontend.
 */

/* =====================================================================
   ➕ Créer des preuves (tâche ou commande via body.taskId / body.orderId)
   - Utilise uploadEvidence.anyCompat() pour tolérer "files" / "proofFile" / "proof"
   - Le contrôleur effectue les ACL fines + checks de contexte
===================================================================== */
router.post(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  // ✅ multi-champs tolérant (évite "Unexpected field" et "Aucun fichier fourni")
  uploadEvidence.anyCompat(),
  ctrl.create
);

/* =====================================================================
   📋 Lister les preuves
   - Admin: peut lister globalement (sans filtre)
   - Agent/Client: doivent fournir taskId ou orderId (contrôlé dans le contrôleur)
   - Query supportées: ?taskId=..., ?orderId=...
===================================================================== */
router.get(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.list
);

/* =====================================================================
   📋 Alias REST — Lister par tâche
   GET /api/evidences/task/:id
===================================================================== */
router.get(
  '/task/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByTask
);

/* =====================================================================
   📋 Alias REST — Lister par commande
   GET /api/evidences/order/:id
===================================================================== */
router.get(
  '/order/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByOrder
);

/* =====================================================================
   ➕ Alias REST — Créer pour une tâche donnée
   POST /api/evidences/task/:id
   - Injecte req.body.taskId depuis l’URL
===================================================================== */
router.post(
  '/task/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  // ✅ multi-champs tolérant
  uploadEvidence.anyCompat(),
  (req, _res, next) => {
    req.body = req.body || {};
    req.body.taskId = req.params.id; // injection sûre
    next();
  },
  ctrl.create
);

/* =====================================================================
   ➕ Alias REST — Créer pour une commande donnée
   POST /api/evidences/order/:id
   - Injecte req.body.orderId depuis l’URL
===================================================================== */
router.post(
  '/order/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  // ✅ multi-champs tolérant
  uploadEvidence.anyCompat(),
  (req, _res, next) => {
    req.body = req.body || {};
    req.body.orderId = req.params.id;
    next();
  },
  ctrl.create
);

/* =====================================================================
   ❌ Supprimer une preuve
   DELETE /api/evidences/:id
   - requireRoles('admin') : garde-fou
   - Le contrôleur gère le nettoyage du fichier + suppression DB
===================================================================== */
router.delete(
  '/:id',
  auth,
  requireRoles('admin'),
  ctrl.remove
);

module.exports = router;
