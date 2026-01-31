'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/franchise.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { requireScopeMatch } = require('../middleware/scope.middleware');

/**
 * ============================================================
 * 🏢 Routes Franchises
 * ============================================================
 * - GET  /franchises : liste (admin)
 * - POST /franchises : création (admin)
 * - PUT  /franchises/:id : update (admin)
 * ============================================================
 */

router.get('/', auth, requireRoles('admin'), ctrl.list);
router.post('/', auth, requireRoles('admin'), requireScopeMatch(), ctrl.create);
router.put('/:id', auth, requireRoles('admin'), requireScopeMatch(), ctrl.update);

module.exports = router;
