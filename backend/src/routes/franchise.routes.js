'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/franchise.controller');
const auth = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/authorization.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const { requireScopeMatch } = require('../middleware/scope.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createFranchiseSchema,
  updateFranchiseSchema,
} = require('../validators/franchise.schemas');

const NON_REGRESSIVE_VALIDATION_OPTIONS = {
  allowUnknown: true,
  stripUnknown: false,
};

/**
 * ============================================================
 * 🏢 Routes Franchises
 * ============================================================
 * - GET  /franchises : liste (admin)
 * - POST /franchises : création (admin)
 * - PUT  /franchises/:id : update (admin)
 *
 * Volontairement pas de DELETE : une franchise porte une relation
 * contractuelle/légale réelle. Elle se désactive via
 * PUT /franchises/:id { status: 'inactive' } (modèle Franchise.status,
 * voir franchise.controller.js update), jamais par suppression définitive —
 * contrairement à country/region qui restent des ressources administratives.
 * ============================================================
 */

router.get('/masters', ctrl.listMasterCountries);

router.get('/', auth, requirePermission(PERMISSIONS.FRANCHISE_READ), ctrl.list);
router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.FRANCHISE_WRITE),
  validateBody(createFranchiseSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  requireScopeMatch(),
  ctrl.create
);
router.put(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.FRANCHISE_WRITE),
  validateBody(updateFranchiseSchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  requireScopeMatch(),
  ctrl.update
);

module.exports = router;
