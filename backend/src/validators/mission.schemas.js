'use strict';

const Joi = require('joi');
const { SERVICE_TYPES } = require('../utils/labels');
const { MISSION_STATUS_VALUES } = require('../constants/missionStatus');

const idSchema = Joi.number().integer().positive();

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

// Adresse/coordonnées optionnelles : permet à l'estimation de refléter la destination réelle
// de la mission (déjà saisie à l'étape Location du wizard) plutôt que le seul pays du compte —
// correction transfrontalière, jamais bloquant (aperçu de prix uniquement).
const estimateMissionSchema = Joi.object({
  ...categorySelectionFields,
  address: Joi.string().trim().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  pickupLatitude: Joi.number().min(-90).max(90),
  pickupLongitude: Joi.number().min(-180).max(180),
});

/**
 * Création de mission guidée, utilisateur déjà authentifié (docs/DEV_SPEC_TERANGA_v3.md
 * section 4.1). Même règle qu'à la homepage (missionRequest.schemas.js) : l'adresse reste
 * optionnelle (types sans lieu, ex. paiement/transfert d'argent), mais si fournie doit aboutir
 * à des coordonnées valides côté contrôleur (géocodage ou coordonnées client déjà résolues).
 */
const createMissionSchema = Joi.object({
  ...categorySelectionFields,
  title: Joi.string().trim().min(3).max(150).required(),
  description: Joi.string().trim().max(2000).allow('', null),
  savedLocationId: idSchema.allow(null),
  address: Joi.string().trim().max(255).allow('', null),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  // Retrait — structure seulement ici (optionnel pour Joi) ; l'obligation "requis pour la
  // filière livraison" est une règle métier vérifiée dans le contrôleur, pas dans le schéma
  // (docs/DEV_SPEC_TERANGA_v6_PHASE3.md §1.1).
  pickupAddress: Joi.string().trim().max(255).allow('', null),
  pickupLatitude: Joi.number().min(-90).max(90),
  pickupLongitude: Joi.number().min(-180).max(180),
});

/**
 * Assignation manuelle (docs/DEV_SPEC_TERANGA_v3.md section 4.2/3.3) — pas de short-list/Distance
 * Matrix ici, ça reste le moteur de matching automatique du Lot 4. `providerId` (exécutant filière)
 * et `agentId` (superviseur, voir section 8 de ce chantier) sont indépendants : absent = ne pas
 * toucher ce champ, `null` = désassigner, nombre = assigner/réassigner. Au moins l'un des deux doit
 * être fourni.
 */
const assignMissionSchema = Joi.object({
  providerId: idSchema.allow(null),
  agentId: idSchema.allow(null),
}).or('providerId', 'agentId');

/**
 * Transition de statut (section 2). Les permissions fines (qui peut déclencher quelle transition)
 * sont vérifiées dans le contrôleur, pas ici — Joi ne valide que la forme.
 */
const updateMissionStatusSchema = Joi.object({
  toStatus: Joi.string()
    .valid(...MISSION_STATUS_VALUES)
    .required(),
  // Réconciliation cash à la remise (docs/DEV_SPEC_TERANGA_v6_PHASE3.md §5) — optionnel, ignoré
  // hors transition COMPLETED filière livraison (règle métier vérifiée dans le contrôleur).
  collectedAmount: Joi.number().min(0).allow(null),
});

/**
 * Ping de position d'un exécutant en mission active (section 3.3/4.2).
 */
const missionLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
});

/**
 * Demande de déplacement interne, Cas 1 (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4.2) — position
 * actuelle de l'exécutant (retrait), adresse optionnelle (affichage seulement).
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
