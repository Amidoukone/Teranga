'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/missionRequest.controller');
const {
  guestLimiter,
  publicQuoteLimiter,
} = require('../middleware/rateLimit.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createMissionRequestSchema,
  estimateMissionRequestSchema,
} = require('../validators/missionRequest.schemas');

/**
 * Point d'entrée public homepage (docs/DEV_SPEC_TERANGA_v3.md, Lot 2) : pas
 * d'auth requise (c'est tout le but), rate-limité car c'est un endpoint
 * public qui écrit un compte + une mission.
 */
router.post(
  '/estimate',
  publicQuoteLimiter,
  validateBody(estimateMissionRequestSchema),
  ctrl.estimate
);
router.get('/reverse-geocode', publicQuoteLimiter, ctrl.reverseGeocodeLocation);
router.post('/', guestLimiter, validateBody(createMissionRequestSchema), ctrl.create);

module.exports = router;
