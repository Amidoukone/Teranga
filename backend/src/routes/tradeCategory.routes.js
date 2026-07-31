'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/tradeCategory.controller');
const auth = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/roles.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createTradeCategorySchema,
  updateTradeCategorySchema,
} = require('../validators/tradeCategory.schemas');

const NON_REGRESSIVE_VALIDATION_OPTIONS = {
  allowUnknown: true,
  stripUnknown: false,
};

// Public (docs/DEV_SPEC_TERANGA_v3.md section 3.3) : pas d'auth requise,
// simple catalogue de filières actives (wizard mission, formulaire prestataire).
router.get('/', ctrl.list);

// Page de gestion admin/master : toutes les filières, actives et inactives.
router.get('/admin', auth, requireAdmin, ctrl.listForAdmin);

// Écriture : super admin OU master (requireAdmin, pas requireGlobalAdmin) — la
// filière n'est pas scopée par pays/région, un master doit pouvoir en créer
// pour onboarder ses prestataires localement.
router.post(
  '/',
  auth,
  requireAdmin,
  validateBody(createTradeCategorySchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.create
);
router.put(
  '/:id',
  auth,
  requireAdmin,
  validateBody(updateTradeCategorySchema, NON_REGRESSIVE_VALIDATION_OPTIONS),
  ctrl.update
);
router.delete('/:id', auth, requireAdmin, ctrl.remove);

module.exports = router;
