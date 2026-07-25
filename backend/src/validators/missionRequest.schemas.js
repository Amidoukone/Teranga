'use strict';

const Joi = require('joi');
const { SERVICE_TYPES } = require('../utils/labels');

/**
 * Candidature/demande invitée depuis la homepage (docs/DEV_SPEC_TERANGA_v3.md,
 * Lot 2). `pin` est volontairement plus court que le mot de passe exigé par
 * /auth/register (8 caractères) : c'est un point d'entrée à friction minimale
 * pour un premier contact, pas une inscription délibérée. Il reste un vrai
 * mot de passe bcrypt côté serveur, réutilisable pour se reconnecter.
 */
const createMissionRequestSchema = Joi.object({
  phone: Joi.string().trim().required(),
  pin: Joi.string().trim().min(4).max(64).required(),
  firstName: Joi.string().trim().max(80).allow('', null),
  countryId: Joi.number().integer().positive().required(),
  requestKind: Joi.string().valid('trade_category', 'classic').required(),
  tradeCategoryId: Joi.number()
    .integer()
    .positive()
    .when('requestKind', { is: 'trade_category', then: Joi.required(), otherwise: Joi.forbidden() }),
  serviceType: Joi.string()
    .valid(...Object.keys(SERVICE_TYPES))
    .when('requestKind', { is: 'classic', then: Joi.required(), otherwise: Joi.forbidden() }),
  title: Joi.string().trim().min(3).max(150).required(),
  description: Joi.string().trim().max(2000).allow('', null),
  address: Joi.string().trim().max(255).allow('', null),
});

module.exports = {
  createMissionRequestSchema,
};
