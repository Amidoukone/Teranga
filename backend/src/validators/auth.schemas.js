'use strict';

const Joi = require('joi');

const email = Joi.string().email().trim().lowercase();
const password = Joi.string().min(8);
const optionalEmail = email.empty('').allow(null);
const optionalPhone = Joi.string().trim().max(30).empty('').allow(null);
const loginIdentifier = Joi.string().trim().max(255).empty('').allow(null);
const noDigitNamePattern = /^(?!.*\p{N}).*$/u;
const optionalNameWithoutDigits = Joi.string()
  .trim()
  .max(80)
  .pattern(noDigitNamePattern)
  .allow('', null)
  .messages({
    'string.pattern.base':
      'Le nom ne doit pas contenir de chiffres',
  });

const registerSchema = Joi.object({
  email: optionalEmail,
  password: password.required(),
  firstName: optionalNameWithoutDigits,
  lastName: optionalNameWithoutDigits,
  phone: optionalPhone,
  country: Joi.string().allow('', null),
  countryId: Joi.number().integer().allow(null),
  regionId: Joi.number().integer().allow(null),
  language: Joi.string().allow('', null),
})
  .or('email', 'phone')
  .messages({
    'object.missing': 'Email ou telephone requis',
  });

const loginSchema = Joi.object({
  identifier: loginIdentifier,
  email: loginIdentifier,
  phone: loginIdentifier,
  password: Joi.string().required(),
})
  .or('identifier', 'email', 'phone')
  .messages({
    'object.missing': 'Telephone ou email requis',
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
