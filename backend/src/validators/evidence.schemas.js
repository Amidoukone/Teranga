'use strict';

const Joi = require('joi');

const idSchema = Joi.alternatives().try(
  Joi.number().integer().positive(),
  Joi.string().pattern(/^\d+$/)
);

const createEvidenceSchema = Joi.object({
  taskId: idSchema.allow(null),
  orderId: idSchema.allow(null),
  notes: Joi.string().allow('', null).trim(),
}).unknown(true);

module.exports = {
  createEvidenceSchema,
};
