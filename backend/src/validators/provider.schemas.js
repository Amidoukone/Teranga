'use strict';

const Joi = require('joi');
const { PROVIDER_STATUS_VALUES } = require('../constants/providerStatus');

const createProviderSchema = Joi.object({
  userId: Joi.number().integer().positive(),
  type: Joi.string().valid('independent', 'company').required(),
  legalName: Joi.string().trim().max(150).allow('', null),
  displayFirstName: Joi.string().trim().min(2).max(80).required(),
  rccmNumber: Joi.string().trim().max(50).allow('', null),
  phoneNumber: Joi.string().trim().min(6).max(30).required(),
  email: Joi.string().trim().email().allow('', null),
  countryCode: Joi.string().trim().uppercase().length(2).required(),
  hasLiabilityInsurance: Joi.boolean(),
  insuranceExpiresAt: Joi.date().iso().allow(null),
  // Checklist chauffeur (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §2) — pertinent seulement pour la
  // filière Mobilité, mais accepté génériquement (inoffensif pour les autres filières).
  plateNumber: Joi.string().trim().max(20).allow('', null),
  circulationCardNumber: Joi.string().trim().max(50).allow('', null),
  circulationCardVerified: Joi.boolean(),
  tradeCategoryIds: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .required(),
});

const updateProviderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...PROVIDER_STATUS_VALUES)
    .required(),
});

const updateMyAvailabilitySchema = Joi.object({
  availabilityStatus: Joi.string().valid('available', 'busy', 'offline').required(),
  vehicleId: Joi.number().integer().positive().allow(null),
});

const updateMobilityAvailabilitySchema = Joi.object({
  availabilityStatus: Joi.string().valid('available', 'offline').required(),
  vehicleId: Joi.when('availabilityStatus', {
    is: 'available',
    then: Joi.number().integer().positive().required(),
    otherwise: Joi.number().integer().positive().allow(null),
  }),
});

const updateMyLiveLocationSchema = Joi.object({
  vehicleId: Joi.number().integer().positive().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  accuracyMeters: Joi.number().min(0).max(10000).allow(null),
  headingDegrees: Joi.number().min(0).max(360).allow(null),
});

module.exports = {
  createProviderSchema,
  updateProviderStatusSchema,
  updateMyAvailabilitySchema,
  updateMobilityAvailabilitySchema,
  updateMyLiveLocationSchema,
};
