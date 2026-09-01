'use strict';

const Joi = require('joi');

const updateServiceAvailabilitySchema = Joi.object({
  currency: Joi.string().trim().uppercase().min(3).max(10),
  basePrice: Joi.number().min(0).allow(null),
  slaMinutes: Joi.number().integer().min(1).allow(null),
  openingHours: Joi.object().allow(null),
  requiredFields: Joi.array().items(Joi.string().trim().max(100)).allow(null),
  providerRules: Joi.object().allow(null),
  isActive: Joi.boolean(),
  validFrom: Joi.date().iso().allow(null),
  validUntil: Joi.date().iso().min(Joi.ref('validFrom')).allow(null),
}).min(1);

module.exports = { updateServiceAvailabilitySchema };
