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
  language: Joi.string().allow('', null),
});

const loginSchema = Joi.object({
  email: email.required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: email.required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required(),
  password: password.required(),
});

const recoverWithCodeSchema = Joi.object({
  email: email.required(),
  recoveryCode: Joi.string().trim().required(),
  password: password.required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: password.required(),
});

const regenerateRecoveryCodesSchema = Joi.object({
  currentPassword: Joi.string().required(),
});

const updateMeSchema = Joi.object({
  language: Joi.string().allow('', null),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  recoverWithCodeSchema,
  changePasswordSchema,
  regenerateRecoveryCodesSchema,
  updateMeSchema,
};
