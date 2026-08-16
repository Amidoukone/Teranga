'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/provider.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createProviderSchema,
  updateProviderStatusSchema,
  updateMyAvailabilitySchema,
} = require('../validators/provider.schemas');
const { createProviderContractSchema } = require('../validators/providerContract.schemas');

/**
 * ============================================================
 * 🛠️ Routes Teranga Pro — Prestataires
 * (docs/DEV_SPEC_TERANGA_v3.md section 3.3 — v1-only, voir app.js)
 * ============================================================
 * - POST   /providers            : candidature (rôle 'provider') ou onboarding par un admin
 *                                   au nom d'un compte déjà 'provider' (userId requis)
 * - GET    /providers            : liste scopée (admin, category_manager)
 * - GET    /providers/:id        : fiche interne (admin, category_manager)
 * - PATCH  /providers/:id/status : onboarding pending->probation->active
 * - POST   /providers/:id/contracts : contrat de partenariat signé
 * ============================================================
 */

router.post(
  '/',
  auth,
  requireRoles('provider', 'admin'),
  validateBody(createProviderSchema),
  ctrl.create
);

// Chemins littéraux — déclarés avant '/:id' pour ne jamais être capturés par le paramètre
// (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §3).
router.get('/me', auth, requireRoles('provider'), ctrl.me);
router.patch(
  '/me/availability',
  auth,
  requireRoles('provider'),
  validateBody(updateMyAvailabilitySchema),
  ctrl.updateMyAvailability
);
router.get('/available', auth, requireRoles('admin', 'category_manager'), ctrl.listAvailable);

router.get('/', auth, requireRoles('admin', 'category_manager'), ctrl.list);
router.get('/:id', auth, requireRoles('admin', 'category_manager'), ctrl.detail);

router.patch(
  '/:id/status',
  auth,
  requireRoles('admin', 'category_manager'),
  validateBody(updateProviderStatusSchema),
  ctrl.updateStatus
);

router.post(
  '/:id/contracts',
  auth,
  requireRoles('category_manager', 'admin'),
  validateBody(createProviderContractSchema),
  ctrl.addContract
);

module.exports = router;
