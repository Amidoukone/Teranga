'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

/**
 * Routes liées aux utilisateurs
 * - Les clients créent leur compte publiquement via /api/auth/register
 * - Les admins peuvent gérer tous les utilisateurs (CRUD)
 * - Les agents sont créés par l’admin
 */

// 🔒 ADMIN : CRUD complet
router.get('/', auth, requireRoles('admin'), ctrl.listByRole);
router.get('/:id', auth, requireRoles('admin'), ctrl.getById);
router.post('/', auth, requireRoles('admin'), ctrl.createUser);
router.put('/:id', auth, requireRoles('admin'), ctrl.updateUser);
router.delete('/:id', auth, requireRoles('admin'), ctrl.deleteUser);

// ✅ Spécifique : création agent (déjà utilisée)
router.post('/agents', auth, requireRoles('admin'), ctrl.createAgent);

// ✅ Profil utilisateur connecté
router.get('/me', auth, ctrl.me);

module.exports = router;
