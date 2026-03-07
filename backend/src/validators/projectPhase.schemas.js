'use strict';

const Joi = require('joi');

const PHASE_STATUSES = ['pending', 'active', 'completed'];

const optionalIsoDate = Joi.alternatives().try(
  Joi.string().trim().isoDate(),
  Joi.valid(null),
  Joi.string().valid('')
);

const createProjectPhaseSchema = Joi.object({
  projectId: Joi.number().integer().positive().required(),
  title: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().max(5000).allow('', null),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...PHASE_STATUSES),
  progress: Joi.number().min(0).max(100),
});

const updateProjectPhaseSchema = Joi.object({
  projectId: Joi.number().integer().positive(),
  title: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().max(5000).allow('', null),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...PHASE_STATUSES),
  progress: Joi.number().min(0).max(100),
});

module.exports = {
  createProjectPhaseSchema,
  updateProjectPhaseSchema,
};
