'use strict';

const Joi = require('joi');
const { SERVICE_TYPES } = require('../utils/labels');
const { DELIVERY_PACKAGE_TYPE_VALUES } = require('../constants/deliveryPackage');
const { DELIVERY_HANDLING_VALUES } = require('../constants/deliveryHandling');

const vehicleTypeSchema = Joi.string().valid('motorcycle', 'car');

/**
 * Candidature/demande invitÃ©e depuis la homepage (docs/DEV_SPEC_TERANGA_v3.md,
 * Lot 2). `pin` est facultatif pour un nouveau numÃ©ro : un code Ã  six chiffres
 * est alors gÃ©nÃ©rÃ© et affichÃ© une seule fois. Pour un numÃ©ro dÃ©jÃ  connu, le
 * contrÃ´leur exige toujours le bon code avant d'ouvrir une session.
 */
const createMissionRequestSchema = Joi.object({
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
  // Adresse toujours optionnelle (types de demande "classique" sans lieu,
  // ex. paiement/transfert d'argent) â€” mais quand elle est fournie, elle doit
  // aboutir Ã  des coordonnÃ©es valides (gÃ©ocodage serveur, voir contrÃ´leur),
  // sinon la requÃªte est rejetÃ©e plutÃ´t que silencieusement acceptÃ©e sans
  // coordonnÃ©es (docs/DEV_SPEC_TERANGA_v3.md section 0.5).
  address: Joi.string().trim().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  // Point de retrait/dÃ©part pour Livraison et MobilitÃ©. L'obligation dÃ©pend du slug de la
  // filiÃ¨re et reste donc contrÃ´lÃ©e dans le contrÃ´leur aprÃ¨s chargement de TradeCategory.
  pickupAddress: Joi.string().trim().max(255).allow('', null),
  pickupLatitude: Joi.number().min(-90).max(90),
  pickupLongitude: Joi.number().min(-180).max(180),
  requestedVehicleType: vehicleTypeSchema,
  packageType: Joi.string().valid(...DELIVERY_PACKAGE_TYPE_VALUES),
  recipientName: Joi.string().trim().max(120).allow('', null),
  recipientPhone: Joi.string().trim().max(40).allow('', null),
  packageHandling: Joi.array()
    .items(Joi.string().valid(...DELIVERY_HANDLING_VALUES))
    .unique()
    .max(DELIVERY_HANDLING_VALUES.length),
});

// AperÃ§u public sans Ã©criture : aucune identitÃ© n'est nÃ©cessaire pour voir le prix d'un trajet.
const estimateMissionRequestSchema = Joi.object({
  countryId: Joi.number().integer().positive().required(),
  tradeCategoryId: Joi.number().integer().positive().required(),
  requestedVehicleType: vehicleTypeSchema.default('motorcycle'),
  packageType: Joi.string().valid(...DELIVERY_PACKAGE_TYPE_VALUES),
  address: Joi.string().trim().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  pickupAddress: Joi.string().trim().max(255).allow('', null),
  pickupLatitude: Joi.number().min(-90).max(90),
  pickupLongitude: Joi.number().min(-180).max(180),
});

module.exports = {
  createMissionRequestSchema,
  estimateMissionRequestSchema,
};

