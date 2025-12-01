'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/property.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

// ✅ BON middleware ImageKit (memoryStorage)
const upload = require('../middleware/uploadProperties.middleware');

/**
 * ============================================================
 * ROUTES PROPERTIES — Version corrigée et complète
 * ============================================================
 * - Client : CRUD sur ses biens
 * - Admin  : CRUD + création pour n’importe quel client
 * - Support complet pour ImageKit (upload buffers)
 * - Compatibilité frontend (fallbacks / alias)
 * ============================================================
 */

/* ============================================================
   🔵 ROUTES DE BASE
============================================================ */

/**
 * ➕ Créer un bien
 * - Client : crée pour lui-même
 * - Admin : peut cibler ownerId | clientId | ownerEmail
 */
router.post(
  '/',
  auth,
  upload.array('files', 5),
  ctrl.create
);

/**
 * 📜 Liste des biens (client = ses biens / admin = tous ou ?clientId=)
 */
router.get(
  '/',
  auth,
  ctrl.list
);

/**
 * ✏️ Mettre à jour un bien
 */
router.put(
  '/:id',
  auth,
  upload.array('files', 5),
  ctrl.update
);

/**
 * 🗑 Supprimer un bien
 */
router.delete(
  '/:id',
  auth,
  ctrl.remove
);

/* ============================================================
   🔵 ROUTES ADMIN — CRÉATION POUR UN AUTRE CLIENT
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
 * ➕ ADMIN : Créer un bien pour un client donné
 * POST /api/properties/client/:id
 */
router.post(
  '/client/:id',
  auth,
  requireRoles('admin'),
  upload.array('files', 5),
  attachOwnerIdFromParam,
  (req, res, next) => {
    console.log(
      `🛠️ [ADMIN] createProperty via /client/:id → clientId=${req.params.id} | files=${(req.files || []).length}`
    );
    return ctrl.create(req, res, next);
  }
);

/**
 * ➕ ADMIN : Créer un bien via ownerId | clientId | ownerEmail dans le body
 * POST /api/properties/admin
 */
router.post(
  '/admin',
  auth,
  requireRoles('admin'),
  upload.array('files', 5),
  (req, res, next) => {
    const { ownerId, clientId, ownerEmail } = req.body || {};
    console.log(
      `🛠️ [ADMIN] createProperty via /admin (ownerId=${ownerId} | clientId=${clientId} | email=${ownerEmail}) | files=${(req.files || []).length}`
    );
    return ctrl.create(req, res, next);
  }
);

/* ============================================================
   🔵 ROUTES ADMIN — LISTE PAR CLIENT
============================================================ */

/**
 * 📜 Admin : liste des biens d’un client spécifique
 */
router.get(
  '/client/:id',
  auth,
  requireRoles('admin'),
  ctrl.listByClient
);

/**
 * 📜 Alias admin : /properties/by-owner/:id
 */
router.get(
  '/by-owner/:id',
  auth,
  requireRoles('admin'),
  ctrl.listByClient
);

/* ============================================================
   🔵 COMPATIBILITÉ FRONTEND
============================================================ */

/**
 * 🔁 Compat frontend : POST /properties/create
 * (ancienne route utilisée dans ton frontend → évite les 404)
 */
router.post(
  '/create',
  auth,
  upload.array('files', 5),
  (req, res, next) => {
    console.log("📌 Compat route POST /properties/create utilisée");
    return ctrl.create(req, res, next);
  }
);

/**
 * 🔁 Compat frontend : /admin/properties/create
 * (optionnel mais utile si d'anciens clients ou scripts l'utilisent)
 */
router.post(
  '/admin/create',
  auth,
  requireRoles('admin'),
  upload.array('files', 5),
  (req, res, next) => {
    console.log("📌 Compat route POST /admin/properties/create utilisée");
    return ctrl.create(req, res, next);
  }
);

/* ============================================================ */

module.exports = router;
