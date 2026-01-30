'use strict';

const Joi = require('joi');

const email = Joi.string().email().trim().lowercase();
const password = Joi.string().min(8);

const registerSchema = Joi.object({
  email: email.required(),
  password: password.required(),
  firstName: Joi.string().allow('', null),
  lastName: Joi.string().allow('', null),
  phone: Joi.string().allow('', null),
  country: Joi.string().allow('', null),
  countryId: Joi.number().integer().allow(null),
  regionId: Joi.number().integer().allow(null),
});

const loginSchema = Joi.object({
  email: email.required(),
  password: Joi.string().required(),
});

module.exports = {
  registerSchema,
  loginSchema,
};
