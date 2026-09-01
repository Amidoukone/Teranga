'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/region.controller');
const auth = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/authorization.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createRegionSchema,
  updateRegionSchema,
} = require('../validators/region.schemas');

const NON_REGRESSIVE_VALIDATION_OPTIONS = {
  allowUnknown: true,
  stripUnknown: false,
};

/**
 * ============================================================
 * 🗺️ Routes Régions (Regions)
 * ============================================================
 * - GET  /regions : liste des régions (auth requis)
 * - POST /regions : création (admin)
 * - PUT  /regions/:id : update (admin)
 * - DELETE /regions/:id : suppression (admin)
 * ============================================================
 */

// Liste (tous rôles authentifiés)
router.get('/', auth, requirePermission(PERMISSIONS.GEO_REFERENCE_READ), ctrl.list);

// Admin uniquement
router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.GEO_REFERENCE_MANAGE),
  validateBody(createRegionSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.create
);
router.put(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.GEO_REFERENCE_MANAGE),
  validateBody(updateRegionSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.update
);
router.delete(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.GEO_REFERENCE_MANAGE),
  ctrl.remove
);

module.exports = router;
