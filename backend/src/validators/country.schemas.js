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
});

module.exports = {
  createCountrySchema,
  updateCountrySchema,
};
