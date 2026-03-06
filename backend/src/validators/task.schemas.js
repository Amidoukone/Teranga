'use strict';

const Joi = require('joi');

const idSchema = Joi.alternatives().try(
  Joi.number().integer().positive(),
  Joi.string().pattern(/^\d+$/)
);

const createTaskSchema = Joi.object({
  serviceId: idSchema.allow(null),
  propertyId: idSchema.allow(null),
  title: Joi.string().trim().required(),
  type: Joi.string().trim().required(),
  description: Joi.string().allow('', null).trim(),
  priority: Joi.string().allow('', null).trim(),
  dueDate: Joi.alternatives().try(Joi.date(), Joi.string()).allow('', null),
  estimatedCost: Joi.alternatives().try(Joi.number(), Joi.string()).allow('', null),
  currency: Joi.string().allow('', null).trim(),
  assignedTo: idSchema.allow(null),
}).unknown(true);

const updateStatusSchema = Joi.object({
  status: Joi.string().trim().required(),
}).unknown(true);

const assignAgentSchema = Joi.object({
  agentId: idSchema.required(),
}).unknown(true);

module.exports = {
  createTaskSchema,
  updateStatusSchema,
  assignAgentSchema,
};
