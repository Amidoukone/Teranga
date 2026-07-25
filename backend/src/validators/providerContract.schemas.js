'use strict';

const Joi = require('joi');

const createProviderContractSchema = Joi.object({
  commissionRate: Joi.number().min(0).max(100).precision(2).required(),
  nonCircumventionMonths: Joi.number().integer().min(0).max(120),
  signedAt: Joi.date().iso().required(),
  documentUrl: Joi.string().trim().uri().max(255).allow('', null),
});

module.exports = {
  createProviderContractSchema,
};
