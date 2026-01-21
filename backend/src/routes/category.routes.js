// backend/src/routes/category.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

// ✅ Master = admin scoped (filtrage réel dans le controller/service)
router.post('/', auth, requireRoles('admin', 'master'), ctrl.create);
router.get('/', auth, requireRoles('admin', 'master', 'agent', 'client'), ctrl.list);
router.get('/:id', auth, requireRoles('admin', 'master', 'agent', 'client'), ctrl.detail);
router.put('/:id', auth, requireRoles('admin', 'master'), ctrl.update);
router.delete('/:id', auth, requireRoles('admin', 'master'), ctrl.remove);

module.exports = router;
