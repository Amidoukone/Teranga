'use strict';

const Joi = require('joi');

const createProductSchema = Joi.object({
  categoryId: Joi.number().integer().allow(null),
  name: Joi.string().min(1).required(),
  sku: Joi.string().allow('', null),
  price: Joi.number().allow(null),
  currency: Joi.string().allow('', null),
  stock: Joi.number().integer().allow(null, ''),
  description: Joi.string().allow('', null),
  shortDescription: Joi.string().allow('', null),
  isActive: Joi.boolean().allow(null),
  countryId: Joi.number().integer().allow(null, ''),
  regionId: Joi.number().integer().allow(null, ''),
});

const updateProductSchema = Joi.object({
  categoryId: Joi.number().integer().allow(null),
  name: Joi.string().min(1).allow('', null),
  sku: Joi.string().allow('', null),
  price: Joi.number().allow(null),
  currency: Joi.string().allow('', null),
  stock: Joi.number().integer().allow(null, ''),
  description: Joi.string().allow('', null),
  shortDescription: Joi.string().allow('', null),
  isActive: Joi.boolean().allow(null),
  countryId: Joi.number().integer().allow(null, ''),
  regionId: Joi.number().integer().allow(null, ''),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
};
