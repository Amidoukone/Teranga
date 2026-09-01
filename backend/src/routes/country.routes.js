'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/country.controller');
const auth = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/authorization.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createCountrySchema,
  updateCountrySchema,
} = require('../validators/country.schemas');

const NON_REGRESSIVE_VALIDATION_OPTIONS = {
  allowUnknown: true,
  stripUnknown: false,
};

/**
 * ============================================================
 * 🌍 Routes Pays (Countries)
 * ============================================================
 * - GET  /countries : liste des pays (auth requis)
 *   • admin: peut ajouter ?includeInactive=true (géré dans le contrôleur)
 * - POST /countries : création (admin)
 * - PUT  /countries/:id : update (admin)
 * - DELETE /countries/:id : suppression (admin)
 * ============================================================
 */

// Liste (tous rôles authentifiés)
router.get('/', auth, requirePermission(PERMISSIONS.GEO_REFERENCE_READ), ctrl.list);

// Admin uniquement
router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.GEO_REFERENCE_MANAGE),
  validateBody(createCountrySchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.create
);
router.put(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.GEO_REFERENCE_MANAGE),
  validateBody(updateCountrySchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.update
);
router.delete(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.GEO_REFERENCE_MANAGE),
  ctrl.remove
);

module.exports = router;
