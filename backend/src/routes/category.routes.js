// backend/src/routes/category.routes.js
'use strict';
const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

router.post('/', auth, requireRoles('admin'), ctrl.create);
router.get('/', auth, requireRoles('admin', 'agent', 'client'), ctrl.list);
router.get('/:id', auth, requireRoles('admin', 'agent', 'client'), ctrl.detail);
router.put('/:id', auth, requireRoles('admin'), ctrl.update);
router.delete('/:id', auth, requireRoles('admin'), ctrl.remove);

module.exports = router;
