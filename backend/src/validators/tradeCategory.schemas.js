'use strict';

const Joi = require('joi');

const createTradeCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  slug: Joi.string().trim().max(120).allow('', null),
  requiresCompany: Joi.boolean(),
  defaultWarrantyDays: Joi.number().integer().min(0).max(3650),
  isActive: Joi.boolean(),
  // Périmètre géo : uniquement pris en compte pour un admin global (un master hérite toujours
  // de son propre scope côté contrôleur, ces champs sont ignorés pour lui). null/absent = filière
  // globale.
  countryId: Joi.number().integer().positive().allow(null),
  country_id: Joi.number().integer().positive().allow(null),
  regionId: Joi.number().integer().positive().allow(null),
  region_id: Joi.number().integer().positive().allow(null),
});

const updateTradeCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  slug: Joi.string().trim().max(120).allow('', null),
  requiresCompany: Joi.boolean(),
  defaultWarrantyDays: Joi.number().integer().min(0).max(3650),
  isActive: Joi.boolean(),
  countryId: Joi.number().integer().positive().allow(null),
  country_id: Joi.number().integer().positive().allow(null),
  regionId: Joi.number().integer().positive().allow(null),
  region_id: Joi.number().integer().positive().allow(null),
});

module.exports = {
  createTradeCategorySchema,
  updateTradeCategorySchema,
};
