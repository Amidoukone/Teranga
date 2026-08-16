'use strict';

const Joi = require('joi');

const createRegionSchema = Joi.object({
  countryId: Joi.number().integer().positive(),
  country_id: Joi.number().integer().positive(),
  name: Joi.string().trim().min(2).max(120).required(),
  code: Joi.string().trim().max(30).allow('', null),
  isActive: Joi.boolean(),
}).or('countryId', 'country_id');

const updateRegionSchema = Joi.object({
  countryId: Joi.any().forbidden(),
  country_id: Joi.any().forbidden(),
  name: Joi.string().trim().min(2).max(120),
  code: Joi.string().trim().max(30).allow('', null),
  isActive: Joi.boolean(),
  // Numéro de contact pour la marketplace immobilière (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7).
  contactPhone: Joi.string().trim().max(30).allow('', null),
});

module.exports = {
  createRegionSchema,
  updateRegionSchema,
};
