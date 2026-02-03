'use strict';

const Joi = require('joi');

const idSchema = Joi.alternatives().try(
  Joi.number().integer().positive(),
  Joi.string().pattern(/^\d+$/),
  Joi.string().allow('')
);

const createServiceSchema = Joi.object({
  clientId: idSchema.allow(null),
  agentId: idSchema.allow(null),
  propertyId: idSchema.allow(null),
  type: Joi.string().allow('', null).trim(),
  title: Joi.string().allow('', null).trim(),
  description: Joi.string().allow('', null).trim(),
  contactPerson: Joi.string().allow('', null).trim(),
  contactPhone: Joi.string().allow('', null).trim(),
  address: Joi.string().allow('', null).trim(),
  budget: Joi.alternatives().try(Joi.number(), Joi.string()).allow('', null),
  countryId: idSchema.allow(null),
  regionId: idSchema.allow(null),
}).unknown(true);

const updateServiceSchema = createServiceSchema;

const assignServiceSchema = Joi.object({
  serviceId: idSchema.required(),
  agentId: idSchema.required(),
}).unknown(true);

module.exports = {
  createServiceSchema,
  updateServiceSchema,
  assignServiceSchema,
};
