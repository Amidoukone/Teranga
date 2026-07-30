// backend/src/routes/mission.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/mission.controller');
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
} = require('../validators/mission.schemas');

/**
 * ROUTES MISSIONS — création guidée (section 4.1) + suivi en direct (section 4.2)
 * v1-only par design (section 0.5) : jamais montées sous /api legacy.
 */

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

// Flux de suivi (carte + statut + ETA) — client propriétaire, agent (exécutant ou superviseur
// passif), prestataire exécutant. Permissions fines + scope vérifiés dans le contrôleur.
router.get('/:id/track', auth, requireRoles('client', 'agent', 'provider'), ctrl.track);

// "Mes missions" — agent (missions filière où il est superviseur/exécutant) ou prestataire
// (ses missions assignées). Les missions classiques agent restent sur /services/agent/services.
router.get('/mine', auth, requireRoles('agent', 'provider'), ctrl.mine);

module.exports = router;
