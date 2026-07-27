'use strict';

const Joi = require('joi');

const createSavedLocationSchema = Joi.object({
  label: Joi.string().trim().max(80).allow('', null),
  address: Joi.string().trim().min(1).max(255).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});

module.exports = {
  createSavedLocationSchema,
};
