'use strict';

const router = require('express').Router();
const controller = require('../controllers/serviceCatalog.controller');
const auth = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/authorization.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const {
  updateServiceAvailabilitySchema,
} = require('../validators/serviceCatalog.schemas');

router.get('/', controller.list);
router.get(
  '/admin',
  auth,
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  controller.listForAdmin
);
router.patch(
  '/availabilities/:id',
  auth,
  requirePermission(PERMISSIONS.CATALOG_MANAGE),
  validateBody(updateServiceAvailabilitySchema),
  controller.updateAvailability
);

module.exports = router;
