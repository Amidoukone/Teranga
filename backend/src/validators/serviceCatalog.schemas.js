'use strict';

const Joi = require('joi');
const { coordinationPolicySchema } = require('./coordination.schemas');

const updateServiceAvailabilitySchema = Joi.object({
  currency: Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/),
  basePrice: Joi.number().min(0).allow(null),
  slaMinutes: Joi.number().integer().min(1).allow(null),
  openingHours: Joi.object().allow(null),
  requiredFields: Joi.array().items(Joi.string().trim().max(100)).allow(null),
  providerRules: Joi.object({
    coordination: coordinationPolicySchema,
    serviceOutcome: Joi.string().trim().min(10).max(2000).allow(''),
    requiredEvidenceTypes: Joi.array().items(Joi.string().valid('photo', 'document', 'receipt', 'other')).unique(),
  }).unknown(true).allow(null),
  isActive: Joi.boolean(),
  validFrom: Joi.date().iso().allow(null),
  validUntil: Joi.date().iso().allow(null),
}).min(1);

module.exports = { updateServiceAvailabilitySchema };
