'use strict';

const Joi = require('joi');

const createTradeCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  slug: Joi.string().trim().max(120).allow('', null),
  requiresCompany: Joi.boolean(),
  defaultWarrantyDays: Joi.number().integer().min(0).max(3650),
  isActive: Joi.boolean(),
});

const updateTradeCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  slug: Joi.string().trim().max(120).allow('', null),
  requiresCompany: Joi.boolean(),
  defaultWarrantyDays: Joi.number().integer().min(0).max(3650),
  isActive: Joi.boolean(),
});

module.exports = {
  createTradeCategorySchema,
  updateTradeCategorySchema,
};
