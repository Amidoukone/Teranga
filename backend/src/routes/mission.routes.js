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

// Flux de suivi consommé par le client (carte + statut + ETA).
router.get('/:id/track', auth, requireRoles('client'), ctrl.track);

module.exports = router;
