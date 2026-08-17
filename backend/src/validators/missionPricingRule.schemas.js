'use strict';

const Joi = require('joi');
const { SERVICE_TYPES } = require('../utils/labels');

const idSchema = Joi.number().integer().positive();

// Une règle peut cibler une filière (tradeCategoryId), un type de service classique
// (serviceType), ou aucun des deux (règle générique de repli pour le pays/la région) — mais
// jamais les deux à la fois.
const createMissionPricingRuleSchema = Joi.object({
  countryId: idSchema.required(),
  regionId: idSchema.allow(null),
  tradeCategoryId: idSchema.allow(null),
  serviceType: Joi.string()
    .valid(...Object.keys(SERVICE_TYPES))
    .allow(null),
  vehicleType: Joi.string().valid('motorcycle', 'car').allow(null),
  pricingMode: Joi.string().valid('fixed_estimate', 'quote_only').required(),
  basePrice: Joi.number().min(0).allow(null),
  minPrice: Joi.number().min(0).allow(null),
  pricePerKm: Joi.number().min(0).default(0),
  estimatedDelayMinutes: Joi.number().integer().min(0).required(),
}).custom((value, helpers) => {
  if (value.tradeCategoryId && value.serviceType) {
    return helpers.message(
      'Renseignez au maximum une catégorie : tradeCategoryId OU serviceType, pas les deux.'
    );
  }
  if (value.vehicleType && !value.tradeCategoryId) {
    return helpers.message('vehicleType nécessite une filière tradeCategoryId.');
  }
  return value;
});

const updateMissionPricingRuleSchema = Joi.object({
  pricingMode: Joi.string().valid('fixed_estimate', 'quote_only'),
  basePrice: Joi.number().min(0).allow(null),
  minPrice: Joi.number().min(0).allow(null),
  pricePerKm: Joi.number().min(0),
  estimatedDelayMinutes: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
}).min(1);

module.exports = {
  createMissionPricingRuleSchema,
  updateMissionPricingRuleSchema,
};
