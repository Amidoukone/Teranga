// backend/src/routes/user.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

/**
 * Routes liées aux utilisateurs
 * - Les clients créent leur compte publiquement via /api/auth/register
 * - Les admins peuvent gérer tous les utilisateurs (CRUD)
 * - Les masters peuvent gérer selon leur scope (country/region) côté controller/service
 * - Les agents sont créés par l’admin/master
 */

// ✅ Profil utilisateur connecté (⚠️ DOIT être AVANT "/:id" pour éviter conflit)
router.get('/me', auth, ctrl.me);

// 🔒 ADMIN/MASTER : CRUD complet
router.get('/', auth, requireRoles('admin', 'master'), ctrl.listByRole);
router.post('/', auth, requireRoles('admin', 'master'), ctrl.createUser);

// ✅ Spécifique : création agent (déjà utilisée)
router.post('/agents', auth, requireRoles('admin', 'master'), ctrl.createAgent);

// ⚠️ Routes paramétrées APRÈS les routes statiques (/me, /agents)
router.get('/:id', auth, requireRoles('admin', 'master'), ctrl.getById);
router.put('/:id', auth, requireRoles('admin', 'master'), ctrl.updateUser);
router.delete('/:id', auth, requireRoles('admin', 'master'), ctrl.deleteUser);

module.exports = router;
