'use strict';
const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const upload = require('../middleware/uploadProduct.middleware'); // ✅ ici

// 🟢 Création produit (avec image)
router.post('/', auth, requireRoles('admin'), upload.single('image'), ctrl.create);

// 🔵 Liste des produits
router.get('/', auth, requireRoles('admin', 'agent', 'client'), ctrl.list);

// 🟣 Détail
router.get('/:id', auth, requireRoles('admin', 'agent', 'client'), ctrl.detail);

// 🟠 Mise à jour (avec nouvelle image)
router.put('/:id', auth, requireRoles('admin'), upload.single('image'), ctrl.update);

// 🔴 Suppression
router.delete('/:id', auth, requireRoles('admin'), ctrl.remove);

module.exports = router;
