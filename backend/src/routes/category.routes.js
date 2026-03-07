// backend/src/routes/category.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createCategorySchema,
  updateCategorySchema,
} = require('../validators/category.schemas');

const NON_REGRESSIVE_VALIDATION_OPTIONS = {
  allowUnknown: true,
  stripUnknown: false,
};

// ✅ Admin scoped géré côté controller/service
router.post(
  '/',
  auth,
  requireRoles('admin'),
  validateBody(createCategorySchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.create
);
router.get('/', auth, requireRoles('admin', 'agent', 'client'), ctrl.list);
router.get('/:id', auth, requireRoles('admin', 'agent', 'client'), ctrl.detail);
router.put(
  '/:id',
  auth,
  requireRoles('admin'),
  validateBody(updateCategorySchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.update
);
router.delete('/:id', auth, requireRoles('admin'), ctrl.remove);

module.exports = router;
