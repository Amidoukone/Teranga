'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/provider.controller');
const vehicleCtrl = require('../controllers/vehicle.controller');
const mobilityMediaCtrl = require('../controllers/mobilityMedia.controller');
const auth = require('../middleware/auth.middleware');
const uploadMobilityMedia = require('../middleware/uploadMobilityMedia.middleware');
const { requirePermission } = require('../middleware/authorization.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createProviderSchema,
  updateProviderStatusSchema,
  updateMyAvailabilitySchema,
  updateMobilityAvailabilitySchema,
  updateMyLiveLocationSchema,
} = require('../validators/provider.schemas');
const { createProviderContractSchema } = require('../validators/providerContract.schemas');
const {
  createVehicleSchema,
  updateVehicleSchema,
  updateDriverComplianceSchema,
} = require('../validators/vehicle.schemas');

/**
 * ============================================================
 * 🛠️ Routes Teranga Pro — Prestataires
 * (docs/DEV_SPEC_TERANGA_v3.md section 3.3 — v1-only, voir app.js)
 * ============================================================
 * - POST   /providers            : candidature (rôle 'provider') ou onboarding par un admin
 *                                   au nom d'un compte déjà 'provider' (userId requis)
 * - GET    /providers            : liste scopée (admin, category_manager)
 * - GET    /providers/:id        : fiche interne (admin, category_manager)
 * - PATCH  /providers/:id/status : cycle de vie du compte; aptitude Mobilite retournee separement
 * - POST   /providers/:id/contracts : contrat de partenariat signé
 * ============================================================
 */

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_ONBOARD),
  validateBody(createProviderSchema),
  ctrl.create
);

// Chemins littéraux — déclarés avant '/:id' pour ne jamais être capturés par le paramètre
// (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §3).
router.get('/me', auth, requirePermission(PERMISSIONS.PROVIDER_SELF), ctrl.me);
router.get(
  '/me/dispatch-presence',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_SELF),
  ctrl.getMyDispatchPresence
);
router.post(
  '/me/live-location',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_SELF),
  validateBody(updateMyLiveLocationSchema),
  ctrl.updateMyLiveLocation
);
router.patch(
  '/me/availability',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_SELF),
  validateBody(updateMyAvailabilitySchema),
  ctrl.updateMyAvailability
);
router.get(
  '/available',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  ctrl.listAvailable
);

router.get('/', auth, requirePermission(PERMISSIONS.PROVIDER_MANAGE), ctrl.list);
router.patch(
  '/:id/mobility-availability',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  validateBody(updateMobilityAvailabilitySchema),
  ctrl.updateMobilityAvailability
);
router.post(
  '/:id/mobility-media',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  uploadMobilityMedia,
  mobilityMediaCtrl.upload
);
router.get(
  '/:id/vehicles',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  vehicleCtrl.list
);
router.post(
  '/:id/vehicles',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  validateBody(createVehicleSchema),
  vehicleCtrl.create
);
router.patch(
  '/:id/vehicles/:vehicleId',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  validateBody(updateVehicleSchema),
  vehicleCtrl.update
);
router.patch(
  '/:id/driver-compliance',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  validateBody(updateDriverComplianceSchema),
  ctrl.updateDriverCompliance
);
router.get(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  ctrl.detail
);

router.patch(
  '/:id/status',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  validateBody(updateProviderStatusSchema),
  ctrl.updateStatus
);

router.post(
  '/:id/contracts',
  auth,
  requirePermission(PERMISSIONS.PROVIDER_MANAGE),
  validateBody(createProviderContractSchema),
  ctrl.addContract
);

module.exports = router;
