'use strict';

const Joi = require('joi');
const { SERVICE_TYPES } = require('../utils/labels');
const { MISSION_STATUS_VALUES } = require('../constants/missionStatus');
const { DELIVERY_PACKAGE_TYPE_VALUES } = require('../constants/deliveryPackage');
const { DELIVERY_HANDLING_VALUES } = require('../constants/deliveryHandling');

const idSchema = Joi.number().integer().positive();
const requestedVehicleTypeSchema = Joi.string().valid('motorcycle', 'car');

const categorySelectionFields = {
  executionType: Joi.string().valid('agent', 'provider').required(),
  tradeCategoryId: idSchema.when('executionType', {
    is: 'provider',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  serviceType: Joi.string()
    .valid(...Object.keys(SERVICE_TYPES))
    .when('executionType', {
      is: 'agent',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
};

// Adresse/coordonnÃ©es optionnelles : permet Ã  l'estimation de reflÃ©ter la destination rÃ©elle
// de la mission (dÃ©jÃ  saisie Ã  l'Ã©tape Location du wizard) plutÃ´t que le seul pays du compte â€”
// correction transfrontaliÃ¨re, jamais bloquant (aperÃ§u de prix uniquement).
const estimateMissionSchema = Joi.object({
  ...categorySelectionFields,
  address: Joi.string().trim().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  pickupLatitude: Joi.number().min(-90).max(90),
  pickupLongitude: Joi.number().min(-180).max(180),
  requestedVehicleType: requestedVehicleTypeSchema,
  packageType: Joi.string().valid(...DELIVERY_PACKAGE_TYPE_VALUES),
});

/**
 * CrÃ©ation de mission guidÃ©e, utilisateur dÃ©jÃ  authentifiÃ© (docs/DEV_SPEC_TERANGA_v3.md
 * section 4.1). MÃªme rÃ¨gle qu'Ã  la homepage (missionRequest.schemas.js) : l'adresse reste
 * optionnelle (types sans lieu, ex. paiement/transfert d'argent), mais si fournie doit aboutir
 * Ã  des coordonnÃ©es valides cÃ´tÃ© contrÃ´leur (gÃ©ocodage ou coordonnÃ©es client dÃ©jÃ  rÃ©solues).
 */
const createMissionSchema = Joi.object({
  ...categorySelectionFields,
  title: Joi.string().trim().min(3).max(150).required(),
  description: Joi.string().trim().max(2000).allow('', null),
  savedLocationId: idSchema.allow(null),
  address: Joi.string().trim().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  // Retrait â€” structure seulement ici (optionnel pour Joi) ; l'obligation "requis pour la
  // filiÃ¨re livraison" est une rÃ¨gle mÃ©tier vÃ©rifiÃ©e dans le contrÃ´leur, pas dans le schÃ©ma
  // (docs/DEV_SPEC_TERANGA_v6_PHASE3.md Â§1.1).
  pickupAddress: Joi.string().trim().max(255).allow('', null),
  pickupLatitude: Joi.number().min(-90).max(90),
  pickupLongitude: Joi.number().min(-180).max(180),
  requestedVehicleType: requestedVehicleTypeSchema,
  packageType: Joi.string().valid(...DELIVERY_PACKAGE_TYPE_VALUES),
  recipientName: Joi.string().trim().max(120).allow('', null),
  recipientPhone: Joi.string().trim().max(40).allow('', null),
  packageHandling: Joi.array()
    .items(Joi.string().valid(...DELIVERY_HANDLING_VALUES))
    .unique()
    .max(DELIVERY_HANDLING_VALUES.length),
});

/**
 * Assignation manuelle (docs/DEV_SPEC_TERANGA_v3.md section 4.2/3.3) â€” pas de short-list/Distance
 * Matrix ici, Ã§a reste le moteur de matching automatique du Lot 4. `providerId` (exÃ©cutant filiÃ¨re)
 * et `agentId` (superviseur, voir section 8 de ce chantier) sont indÃ©pendants : absent = ne pas
 * toucher ce champ, `null` = dÃ©sassigner, nombre = assigner/rÃ©assigner. Au moins l'un des deux doit
 * Ãªtre fourni.
 */
const assignMissionSchema = Joi.object({
  providerId: idSchema.allow(null),
  agentId: idSchema.allow(null),
  vehicleId: idSchema,
})
  .or('providerId', 'agentId')
  .custom((value, helpers) => {
    if (value.vehicleId && !value.providerId) {
      return helpers.message('vehicleId necessite un providerId');
    }
    return value;
  });

/**
 * Transition de statut (section 2). Les permissions fines (qui peut dÃ©clencher quelle transition)
 * sont vÃ©rifiÃ©es dans le contrÃ´leur, pas ici â€” Joi ne valide que la forme.
 */
const updateMissionStatusSchema = Joi.object({
  toStatus: Joi.string()
    .valid(...MISSION_STATUS_VALUES)
    .required(),
  // RÃ©conciliation cash Ã  la remise (docs/DEV_SPEC_TERANGA_v6_PHASE3.md Â§5) â€” optionnel, ignorÃ©
  // hors transition COMPLETED filiÃ¨re livraison (rÃ¨gle mÃ©tier vÃ©rifiÃ©e dans le contrÃ´leur).
  collectedAmount: Joi.number().min(0).allow(null),
});

/**
 * Ping de position d'un exÃ©cutant en mission active (section 3.3/4.2).
 */
const missionLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  accuracyMeters: Joi.number().min(0).max(10000).allow(null),
  headingDegrees: Joi.number().min(0).max(360).allow(null),
});

/**
 * Demande de dÃ©placement interne, Cas 1 (docs/DEV_SPEC_TERANGA_v5_PHASE2.md Â§4.2) â€” position
 * actuelle de l'exÃ©cutant (retrait), adresse optionnelle (affichage seulement).
 */
const logisticsRequestSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().trim().max(255).allow('', null),
});

module.exports = {
  estimateMissionSchema,
  createMissionSchema,
  assignMissionSchema,
  updateMissionStatusSchema,
  missionLocationSchema,
  logisticsRequestSchema,
};

