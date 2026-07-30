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

module.exports = {
  createProviderSchema,
  updateProviderStatusSchema,
};
