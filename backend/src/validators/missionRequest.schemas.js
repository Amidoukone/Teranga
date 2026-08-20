'use strict';

const Joi = require('joi');
const { SERVICE_TYPES } = require('../utils/labels');

const vehicleTypeSchema = Joi.string().valid('motorcycle', 'car');

/**
 * Candidature/demande invitée depuis la homepage (docs/DEV_SPEC_TERANGA_v3.md,
 * Lot 2). `pin` est facultatif pour un nouveau numéro : un code à six chiffres
 * est alors généré et affiché une seule fois. Pour un numéro déjà connu, le
 * contrôleur exige toujours le bon code avant d'ouvrir une session.
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
  // ex. paiement/transfert d'argent) — mais quand elle est fournie, elle doit
  // aboutir à des coordonnées valides (géocodage serveur, voir contrôleur),
  // sinon la requête est rejetée plutôt que silencieusement acceptée sans
  // coordonnées (docs/DEV_SPEC_TERANGA_v3.md section 0.5).
  address: Joi.string().trim().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  // Point de retrait/départ pour Livraison et Mobilité. L'obligation dépend du slug de la
  // filière et reste donc contrôlée dans le contrôleur après chargement de TradeCategory.
  pickupAddress: Joi.string().trim().max(255).allow('', null),
  pickupLatitude: Joi.number().min(-90).max(90),
  pickupLongitude: Joi.number().min(-180).max(180),
  requestedVehicleType: vehicleTypeSchema,
});

// Aperçu public sans écriture : aucune identité n'est nécessaire pour voir le prix d'un trajet.
const estimateMissionRequestSchema = Joi.object({
  countryId: Joi.number().integer().positive().required(),
  tradeCategoryId: Joi.number().integer().positive().required(),
  requestedVehicleType: vehicleTypeSchema.default('motorcycle'),
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
