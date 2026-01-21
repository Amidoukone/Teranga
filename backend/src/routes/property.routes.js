// backend/src/routes/property.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/property.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

// ✅ BON middleware ImageKit (memoryStorage)
const upload = require('../middleware/uploadProperties.middleware');

/**
 * ============================================================
 * ROUTES PROPERTIES — Version corrigée et complète (multi-rôles)
 * ============================================================
 * - Client : CRUD sur ses biens (ACL fine côté controller)
 * - Admin  : CRUD + création pour n’importe quel client
 * - Master : mêmes routes que admin, mais scope appliqué côté backend (country/region)
 * - Support complet ImageKit (upload buffers)
 * - Compatibilité frontend (fallbacks / alias)
 * ============================================================
 */

/* ============================================================
   🔵 ROUTES DE BASE
============================================================ */

/**
 * ➕ Créer un bien
 * - Client : crée pour lui-même
 * - Admin/Master : peut cibler ownerId | clientId | ownerEmail (géré côté controller)
 */
router.post(
  '/',
  auth,
  requireRoles('client', 'admin', 'master'),
  upload.array('files', 5),
  ctrl.create
);

/**
 * 📜 Liste des biens
 * - Client : ses biens
 * - Admin/Master : tous ou filtres (?clientId=...) (géré côté controller)
 */
router.get(
  '/',
  auth,
  requireRoles('client', 'admin', 'master'),
  ctrl.list
);

/**
 * ✏️ Mettre à jour un bien
 */
router.put(
  '/:id',
  auth,
  requireRoles('client', 'admin', 'master'),
  upload.array('files', 5),
  ctrl.update
);

/**
 * 🗑 Supprimer un bien
 */
router.delete(
  '/:id',
  auth,
  requireRoles('client', 'admin', 'master'),
  ctrl.remove
);

/* ============================================================
   🔵 ROUTES ADMIN/MASTER — CRÉATION POUR UN AUTRE CLIENT
============================================================ */

/**
 * Injecte ownerId dans req.body à partir du paramètre :id
 */
function attachOwnerIdFromParam(req, _res, next) {
  req.body = req.body || {};
  req.body.ownerId = req.params.id;
  next();
}

/**
 * ➕ ADMIN/MASTER : Créer un bien pour un client donné
 * POST /api/properties/client/:id
 */
router.post(
  '/client/:id',
  auth,
  requireRoles('admin', 'master'),
  upload.array('files', 5),
  attachOwnerIdFromParam,
  (req, res, next) => {
    console.log(
      `🛠️ [ADMIN/MASTER] createProperty via /client/:id → clientId=${req.params.id} | files=${(req.files || []).length}`
    );
    return ctrl.create(req, res, next);
  }
);

/**
 * ➕ ADMIN/MASTER : Créer un bien via ownerId | clientId | ownerEmail dans le body
 * POST /api/properties/admin
 */
router.post(
  '/admin',
  auth,
  requireRoles('admin', 'master'),
  upload.array('files', 5),
  (req, res, next) => {
    const { ownerId, clientId, ownerEmail } = req.body || {};
    console.log(
      `🛠️ [ADMIN/MASTER] createProperty via /admin (ownerId=${ownerId} | clientId=${clientId} | email=${ownerEmail}) | files=${(req.files || []).length}`
    );
    return ctrl.create(req, res, next);
  }
);

/* ============================================================
   🔵 ROUTES ADMIN/MASTER — LISTE PAR CLIENT
============================================================ */

/**
 * 📜 Admin/Master : liste des biens d’un client spécifique
 */
router.get(
  '/client/:id',
  auth,
  requireRoles('admin', 'master'),
  ctrl.listByClient
);

/**
 * 📜 Alias admin/master : /properties/by-owner/:id
 */
router.get(
  '/by-owner/:id',
  auth,
  requireRoles('admin', 'master'),
  ctrl.listByClient
);

/* ============================================================
   🔵 COMPATIBILITÉ FRONTEND
============================================================ */

/**
 * 🔁 Compat frontend : POST /properties/create
 */
router.post(
  '/create',
  auth,
  requireRoles('client', 'admin', 'master'),
  upload.array('files', 5),
  (req, res, next) => {
    console.log('📌 Compat route POST /properties/create utilisée');
    return ctrl.create(req, res, next);
  }
);

/**
 * 🔁 Compat frontend : /admin/properties/create
 */
router.post(
  '/admin/create',
  auth,
  requireRoles('admin', 'master'),
  upload.array('files', 5),
  (req, res, next) => {
    console.log('📌 Compat route POST /admin/properties/create utilisée');
    return ctrl.create(req, res, next);
  }
);

module.exports = router;
