// backend/src/routes/mission.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/mission.controller');
const disputeCtrl = require('../controllers/dispute.controller');
const phoneOrderCtrl = require('../controllers/missionPhoneOrder.controller');
const mobilityDispatchCtrl = require('../controllers/mobilityDispatch.controller');
const safetyCtrl = require('../controllers/missionSafety.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const uploadMissionAttachment = require('../middleware/uploadMissionAttachment.middleware');
const {
  estimateMissionSchema,
  createMissionSchema,
  assignMissionSchema,
  updateMissionStatusSchema,
  missionLocationSchema,
  logisticsRequestSchema,
} = require('../validators/mission.schemas');
const { createDisputeSchema, updateDisputeSchema } = require('../validators/dispute.schemas');
const { phoneOrderSchema } = require('../validators/missionPhoneOrder.schemas');
const {
  verifyStartCodeSchema,
  overrideStartSchema,
  createShareSchema,
  createRatingSchema,
} = require('../validators/missionSafety.schemas');
const {
  publicQuoteLimiter,
  startCodeLimiter,
  writeLimiter,
} = require('../middleware/rateLimit.middleware');

/**
 * ROUTES MISSIONS — création guidée (section 4.1) + suivi en direct (section 4.2)
 * v1-only par design (section 0.5) : jamais montées sous /api legacy.
 */

router.get('/shared/:token', publicQuoteLimiter, safetyCtrl.getShared);

router.post(
  '/estimate',
  auth,
  requireRoles('client'),
  validateBody(estimateMissionSchema),
  ctrl.estimate
);

// Géocodage inverse (bouton "Utiliser ma position actuelle", étape Lieu du wizard) — clé
// serveur uniquement, jamais la clé navigateur (restreinte à Maps JavaScript/Places).
router.get('/reverse-geocode', auth, requireRoles('client'), ctrl.reverseGeocodeLocation);

router.post('/', auth, requireRoles('client'), validateBody(createMissionSchema), ctrl.create);

// Canal opérateur téléphone (docs/DEV_SPEC_TERANGA_v7_PHASE4.md §3) — admin/master saisit une
// course au nom d'un appelant. Chemin littéral, doit rester déclaré avant toute route `/:id/...`
// par convention de ce fichier (même si `/phone-order` ne collisionne avec aucun `/:id` existant).
router.post(
  '/phone-order',
  auth,
  requireRoles('admin'),
  validateBody(phoneOrderSchema),
  phoneOrderCtrl.create
);

router.post(
  '/:id/attachments',
  auth,
  requireRoles('client'),
  uploadMissionAttachment,
  ctrl.addAttachments
);

// Assignation manuelle (admin) — moteur de matching automatique reporté au Lot 4.
router.post(
  '/:id/assign',
  auth,
  requireRoles('admin'),
  validateBody(assignMissionSchema),
  ctrl.assign
);

router.post(
  '/:id/verify-start-code',
  auth,
  requireRoles('provider'),
  startCodeLimiter,
  validateBody(verifyStartCodeSchema),
  safetyCtrl.verifyStartCode
);

router.post(
  '/:id/start-override',
  auth,
  requireRoles('admin'),
  writeLimiter,
  validateBody(overrideStartSchema),
  safetyCtrl.overrideStart
);

router.post(
  '/:id/share',
  auth,
  requireRoles('client'),
  writeLimiter,
  validateBody(createShareSchema),
  safetyCtrl.createShare
);
router.delete(
  '/:id/share',
  auth,
  requireRoles('client'),
  writeLimiter,
  safetyCtrl.revokeShare
);
router.post(
  '/:id/rating',
  auth,
  requireRoles('client'),
  writeLimiter,
  validateBody(createRatingSchema),
  safetyCtrl.createRating
);

router.get(
  '/:id/dispatch-candidates',
  auth,
  requireRoles('admin'),
  mobilityDispatchCtrl.listCandidates
);

// Fenêtre d'acceptation dispatch mobilité (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2) — prestataire
// assigné uniquement.
router.post('/:id/accept', auth, requireRoles('provider'), ctrl.accept);
router.post('/:id/decline', auth, requireRoles('provider'), ctrl.decline);

// Transition de statut (section 2) — permissions fines vérifiées dans le contrôleur.
router.patch(
  '/:id/status',
  auth,
  requireRoles('client', 'agent', 'provider', 'admin'),
  validateBody(updateMissionStatusSchema),
  ctrl.updateStatus
);

// Ping de position d'un exécutant en mission active.
router.post(
  '/:id/location',
  auth,
  requireRoles('agent', 'provider'),
  validateBody(missionLocationSchema),
  ctrl.pingLocation
);

// Demande de déplacement interne, Cas 1 (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §4) — exécutant
// uniquement (agent/prestataire), jamais le client.
router.post(
  '/:id/logistics-request',
  auth,
  requireRoles('agent', 'provider'),
  validateBody(logisticsRequestSchema),
  ctrl.requestLogistics
);

// Flux de suivi (carte + statut + ETA) — client propriétaire, agent (exécutant ou superviseur
// passif), prestataire exécutant. Permissions fines + scope vérifiés dans le contrôleur.
router.get('/:id/track', auth, requireRoles('client', 'agent', 'provider'), ctrl.track);

// "Mes missions" — agent (missions filière où il est superviseur/exécutant) ou prestataire
// (ses missions assignées). Les missions classiques agent restent sur /services/agent/services.
router.get('/mine', auth, requireRoles('agent', 'provider'), ctrl.mine);

// Parcours de litige enrichi (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2). Ouverture réservée au
// client propriétaire ; mise à jour (premier contact / résolution) réservée à l'admin/master du
// scope de la mission — vérifié dans le contrôleur.
// File de traitement (admin/master) — chemin littéral, doit rester déclaré avant toute route
// `/:id/...` pour ne jamais être capturé par un paramètre.
router.get('/disputes', auth, requireRoles('admin'), disputeCtrl.list);

router.post(
  '/:id/disputes',
  auth,
  requireRoles('client'),
  validateBody(createDisputeSchema),
  disputeCtrl.create
);

router.patch(
  '/:id/disputes/:disputeId',
  auth,
  requireRoles('admin'),
  validateBody(updateDisputeSchema),
  disputeCtrl.update
);

module.exports = router;
