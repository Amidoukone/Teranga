'use strict';

const Joi = require('joi');

const FRANCHISE_TYPES = ['MASTER', 'REGIONAL'];
const FRANCHISE_STATUSES = ['active', 'inactive', 'pending'];

const createFranchiseSchema = Joi.object({
  type: Joi.string()
    .trim()
    .uppercase()
    .valid(...FRANCHISE_TYPES)
    .required(),
  countryId: Joi.number().integer().positive(),
  country_id: Joi.number().integer().positive(),
  regionId: Joi.number().integer().positive().allow(null),
  region_id: Joi.number().integer().positive().allow(null),
  legalName: Joi.string().trim().min(2).max(180).required(),
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...FRANCHISE_STATUSES),
}).or('countryId', 'country_id');

const updateFranchiseSchema = Joi.object({
  type: Joi.string()
    .trim()
    .uppercase()
    .valid(...FRANCHISE_TYPES),
  regionId: Joi.number().integer().positive().allow(null),
  region_id: Joi.number().integer().positive().allow(null),
  legalName: Joi.string().trim().min(2).max(180),
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...FRANCHISE_STATUSES),
});

module.exports = {
  createFranchiseSchema,
  updateFranchiseSchema,
};
