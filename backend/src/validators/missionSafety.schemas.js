'use strict';

const Joi = require('joi');

const verifyStartCodeSchema = Joi.object({
  code: Joi.string().pattern(/^\d{4}$/).required(),
});

const overrideStartSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(500).required(),
});

const createShareSchema = Joi.object({
  ttlHours: Joi.number().integer().min(1).max(24).default(6),
});

const createRatingSchema = Joi.object({
  score: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(500).allow('', null),
});

module.exports = {
  verifyStartCodeSchema,
  overrideStartSchema,
  createShareSchema,
  createRatingSchema,
};
