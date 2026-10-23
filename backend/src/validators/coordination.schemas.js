'use strict';

const Joi = require('joi');
const coordinationPolicySchema = Joi.object({
  enabled: Joi.boolean(),
  maxAttempts: Joi.number().integer().min(1).max(10),
  radiusKm: Joi.number().min(1).max(50),
  acceptanceSeconds: Joi.number().integer().min(30).max(3600),
  retrySeconds: Joi.number().integer().min(30).max(3600),
  searchMinutes: Joi.number().integer().min(1).max(1440),
  stageMinutes: Joi.number().integer().min(1).max(10080),
  startMinutes: Joi.number().integer().min(1).max(1440),
  escalationMinutes: Joi.number().integer().min(1).max(1440),
  reminderMinutes: Joi.number().integer().min(5).max(1440),
  validationMinutes: Joi.number().integer().min(1).max(10080),
});
const updateCoordinationSchema = Joi.object({
  mode: Joi.string().valid('manual', 'automatic'),
  ownerUserId: Joi.number().integer().positive(),
  policy: coordinationPolicySchema,
}).min(1);
const updateWorkCoordinationSchema = updateCoordinationSchema.keys({ executorUserId: Joi.number().integer().positive().allow(null) });
module.exports = { coordinationPolicySchema, updateCoordinationSchema, updateWorkCoordinationSchema };
