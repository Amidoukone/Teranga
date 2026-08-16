'use strict';

const Joi = require('joi');

const createCountrySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  isoCode: Joi.string().trim().uppercase().length(2).required(),
  currency: Joi.string().trim().uppercase().max(10).allow('', null),
  defaultLanguage: Joi.string().trim().lowercase().max(10).allow('', null),
  isActive: Joi.boolean(),
});

const updateCountrySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  isoCode: Joi.string().trim().uppercase().length(2),
  currency: Joi.string().trim().uppercase().max(10).allow('', null),
  defaultLanguage: Joi.string().trim().lowercase().max(10).allow('', null),
  isActive: Joi.boolean(),
  // Numéro de contact pour la marketplace immobilière (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7).
  contactPhone: Joi.string().trim().max(30).allow('', null),
});

module.exports = {
  createCountrySchema,
  updateCountrySchema,
};
