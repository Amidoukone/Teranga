'use strict';

const Joi = require('joi');

const createCountrySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  isoCode: Joi.string().trim().uppercase().pattern(/^[A-Z]{2}$/).required(),
  currency: Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/).required(),
  defaultLanguage: Joi.string().trim().lowercase().pattern(/^[a-z]{2,3}(-[a-z]{2})?$/).required(),
  timezone: Joi.string().trim().max(80).required(),
  isActive: Joi.boolean().valid(false),
});

const updateCountrySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  isoCode: Joi.string().trim().uppercase().pattern(/^[A-Z]{2}$/),
  currency: Joi.string().trim().uppercase().pattern(/^[A-Z]{3}$/),
  defaultLanguage: Joi.string().trim().lowercase().pattern(/^[a-z]{2,3}(-[a-z]{2})?$/),
  timezone: Joi.string().trim().max(80),
  isActive: Joi.boolean(),
  // Numéro de contact pour la marketplace immobilière (docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7).
  contactPhone: Joi.string().trim().max(30).allow('', null),
});

module.exports = {
  createCountrySchema,
  updateCountrySchema,
};
