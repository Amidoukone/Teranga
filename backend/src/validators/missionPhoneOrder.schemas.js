'use strict';

const Joi = require('joi');
const { SERVICE_TYPES } = require('../utils/labels');
const { DELIVERY_PACKAGE_TYPE_VALUES } = require('../constants/deliveryPackage');
const { DELIVERY_HANDLING_VALUES } = require('../constants/deliveryHandling');

/**
 * Canal opérateur téléphone (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §3) — un admin/master saisit
 * une course/mission au nom d'un appelant. `pin` optionnel : contrairement à
 * missionRequest.schemas.js (homepage invitée), l'opérateur n'a pas forcément de PIN à faire
 * choisir à l'appelant ; un compte existant n'a de toute façon pas besoin d'être re-vérifié ici
 * (l'autorisation vient du rôle admin de l'appelant de l'API, pas d'un secret client).
 */
const phoneOrderSchema = Joi.object({
  phone: Joi.string().trim().required(),
  pin: Joi.string().trim().min(4).max(64).allow('', null),
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
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  // Retrait/départ — structure seulement ici, l'obligation pour livraison/mobilité est une
  // règle métier vérifiée dans le contrôleur (même principe que mission.schemas.js).
  pickupAddress: Joi.string().trim().max(255).allow('', null),
  pickupLatitude: Joi.number().min(-90).max(90),
  pickupLongitude: Joi.number().min(-180).max(180),
  requestedVehicleType: Joi.string().valid('motorcycle', 'car'),
  packageType: Joi.string().valid(...DELIVERY_PACKAGE_TYPE_VALUES),
  recipientName: Joi.string().trim().max(120).allow('', null),
  recipientPhone: Joi.string().trim().max(40).allow('', null),
  packageHandling: Joi.array()
    .items(Joi.string().valid(...DELIVERY_HANDLING_VALUES))
    .unique()
    .max(DELIVERY_HANDLING_VALUES.length),
});

module.exports = {
  phoneOrderSchema,
};
