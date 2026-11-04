'use strict';
const Joi = require('joi');

// Keep the historical active/history and category filters for existing clients.
const myMissionsQuerySchema = Joi.object({
  view: Joi.string().valid('active', 'history', 'offers').optional(),
  kind: Joi.string().valid('all', 'service', 'taxi', 'delivery').default('all'),
  q: Joi.string().trim().max(200).allow('').default(''),
  page: Joi.number().integer().min(1).max(100000),
  limit: Joi.number().integer().min(1).max(200),
  offset: Joi.number().integer().min(0).max(20000000),
  tradeCategorySlug: Joi.string().trim().max(100),
  excludeTradeCategorySlug: Joi.string().trim().max(100),
});

module.exports = { myMissionsQuerySchema };
