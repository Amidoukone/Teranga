'use strict';

const Joi = require('joi');

const CATEGORY_STATUSES = ['active', 'inactive'];

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  slug: Joi.string().trim().max(180).allow('', null),
  description: Joi.string().trim().max(1000).allow('', null),
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...CATEGORY_STATUSES),
  isActive: Joi.boolean(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  slug: Joi.string().trim().max(180).allow('', null),
  description: Joi.string().trim().max(1000).allow('', null),
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...CATEGORY_STATUSES),
  isActive: Joi.boolean(),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
};
