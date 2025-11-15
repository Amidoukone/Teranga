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
 *   Le contrôleur se charge d'extraire coverImage + gallery
 *   sans casser la compatibilité avec l'existant.
 * ============================================================
 */

// 🟢 Création produit (avec image(s))
// - Ancien front : envoie un seul champ "image" → toujours OK
// - Nouveau front : peut envoyer plusieurs fichiers (image / images / gallery)
router.post(
  '/',
  auth,
  requireRoles('admin'),
  upload.any(),        // ⬅️ au lieu de upload.single('image')
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
// - Compatible ancien mode (une image)
// - Supporte aussi plusieurs fichiers
router.put(
  '/:id',
  auth,
  requireRoles('admin'),
  upload.any(),        // ⬅️ au lieu de upload.single('image')
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
