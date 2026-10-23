'use strict';

const Joi = require('joi');
const {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
} = require('../utils/labels');

const ALLOWED_TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPES || {});
const ALLOWED_TRANSACTION_STATUSES = Object.keys(TRANSACTION_STATUSES || {});

const numericLike = Joi.alternatives().try(
  Joi.number(),
  Joi.string().trim().max(64)
);

const optionalForeignId = Joi.number().integer().positive().allow(null);

const createTransactionSchema = Joi.object({
  serviceId: optionalForeignId,
  taskId: optionalForeignId,
  orderId: optionalForeignId,
  projectId: optionalForeignId,
  type: Joi.string()
    .trim()
    .valid(...ALLOWED_TRANSACTION_TYPES)
    .required(),
  amount: numericLike.required(),
  currency: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z]{3}$/)
    .allow('', null),
  paymentMethod: Joi.string().trim().max(255).allow('', null),
  description: Joi.string().trim().max(5000).allow('', null),
  // Le fichier reçu est transmis en multipart et contrôlé par le contrôleur.
  proofFile: Joi.alternatives().try(Joi.string().max(2000), Joi.object()).allow(null),
  status: Joi.string()
    .trim()
    .valid(...ALLOWED_TRANSACTION_STATUSES),
  countryId: optionalForeignId,
  regionId: optionalForeignId,
  country_id: optionalForeignId,
  region_id: optionalForeignId,
});

const updateTransactionSchema = Joi.object({
  serviceId: optionalForeignId,
  taskId: optionalForeignId,
  orderId: optionalForeignId,
  projectId: optionalForeignId,
  type: Joi.string()
    .trim()
    .valid(...ALLOWED_TRANSACTION_TYPES),
  amount: numericLike,
  currency: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z]{3}$/)
    .allow('', null),
  paymentMethod: Joi.string().trim().max(255).allow('', null),
  description: Joi.string().trim().max(5000).allow('', null),
  proofFile: Joi.alternatives().try(Joi.string().max(2000), Joi.object()).allow(null),
  status: Joi.string()
    .trim()
    .valid(...ALLOWED_TRANSACTION_STATUSES),
  countryId: optionalForeignId,
  regionId: optionalForeignId,
  country_id: optionalForeignId,
  region_id: optionalForeignId,
});

module.exports = {
  createTransactionSchema,
  updateTransactionSchema,
};
