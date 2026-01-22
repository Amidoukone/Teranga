// backend/src/routes/product.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const upload = require('../middleware/uploadProduct.middleware'); // ✅ multer configuré pour les produits

/**
 * ============================================================
 * 🛒 Routes Produits (API)
 * ============================================================
 * - Auth + ACL par rôle (admin / agent / client)
 * - Upload fichiers produit via multer
 * - ✅ Multi-images supportées :
 *     • Ancien mode : single('image') → req.file
 *     • Nouveau mode : any() → req.files (image, images, gallery…)
 *   Le contrôleur extrait coverImage + gallery
 *   sans casser la compatibilité.
 * ============================================================
 */

// 🟢 Création produit (avec image(s))
router.post(
  '/',
  auth,
  requireRoles('admin'),
  upload.any(),
  ctrl.create
);

// 🔵 Liste des produits
router.get(
  '/',
  auth,
  requireRoles('admin', 'agent', 'client'),
  ctrl.list
);

// 🟣 Détail
router.get(
  '/:id',
  auth,
  requireRoles('admin', 'agent', 'client'),
  ctrl.detail
);

// 🟠 Mise à jour (avec nouvelle(s) image(s))
router.put(
  '/:id',
  auth,
  requireRoles('admin'),
  upload.any(),
  ctrl.update
);

// 🔴 Suppression
router.delete(
  '/:id',
  auth,
  requireRoles('admin'),
  ctrl.remove
);

module.exports = router;
