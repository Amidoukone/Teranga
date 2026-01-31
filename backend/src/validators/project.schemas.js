'use strict';

const Joi = require('joi');

const idSchema = Joi.alternatives().try(
  Joi.number().integer().positive(),
  Joi.string().pattern(/^\d+$/)
);

const createProjectSchema = Joi.object({
  title: Joi.string().trim().required(),
  type: Joi.string().trim().required(),
  description: Joi.string().allow('', null).trim(),
  budget: Joi.alternatives().try(Joi.number(), Joi.string()).allow('', null),
  currency: Joi.string().allow('', null).trim(),
  clientId: idSchema.allow(null),
  agentId: idSchema.allow(null),
  countryId: idSchema.allow(null),
  regionId: idSchema.allow(null),
  country_id: idSchema.allow(null),
  region_id: idSchema.allow(null),
}).unknown(true);

const updateProjectSchema = Joi.object({
  title: Joi.string().allow('', null).trim(),
  type: Joi.string().allow('', null).trim(),
  description: Joi.string().allow('', null).trim(),
  budget: Joi.alternatives().try(Joi.number(), Joi.string()).allow('', null),
  currency: Joi.string().allow('', null).trim(),
  agentId: idSchema.allow(null),
  countryId: idSchema.allow(null),
  regionId: idSchema.allow(null),
  country_id: idSchema.allow(null),
  region_id: idSchema.allow(null),
}).unknown(true);

const assignProjectSchema = Joi.object({
  projectId: idSchema.required(),
  agentId: idSchema.allow(null),
}).unknown(true);

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  assignProjectSchema,
};
