'use strict';

const Joi = require('joi');

const idSchema = Joi.alternatives().try(
  Joi.number().integer().positive(),
  Joi.string().pattern(/^\d+$/)
);

const roleSchema = Joi.string().valid('client', 'agent', 'admin');

const userBaseSchema = Joi.object({
  email: Joi.string().email().trim(),
  password: Joi.string().min(6),
  firstName: Joi.string().allow('', null).trim(),
  lastName: Joi.string().allow('', null).trim(),
  phone: Joi.string().allow('', null).trim(),
  language: Joi.string().allow('', null).trim(),
  country: Joi.string().allow('', null).trim(),
  role: roleSchema,
  countryId: idSchema.allow(null),
  regionId: idSchema.allow(null),
  country_id: idSchema.allow(null),
  region_id: idSchema.allow(null),
  scopeCountry: Joi.string().allow('', null).trim(),
  scopeCountryIso: Joi.string().allow('', null).trim(),
  scopeRegion: Joi.string().allow('', null).trim(),
  scopeRegionCode: Joi.string().allow('', null).trim(),
}).unknown(true);

const createUserSchema = userBaseSchema;
const updateUserSchema = userBaseSchema;
const createAgentSchema = userBaseSchema;

module.exports = {
  createUserSchema,
  updateUserSchema,
  createAgentSchema,
};
