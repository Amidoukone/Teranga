// backend/src/routes/missionPricingRule.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/missionPricingRule.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const {
  createMissionPricingRuleSchema,
  updateMissionPricingRuleSchema,
} = require('../validators/missionPricingRule.schemas');

/**
 * ROUTES TARIFICATION DE MISSION (docs/DEV_SPEC_TERANGA_v3.md section 4.1)
 * Admin uniquement (global ou scopé pays/région — "super_admin"/"master" au sens business,
 * pas un rôle DB distinct, voir missionPricingRule.controller.js). v1-only par design.
 */

router.get('/', auth, requireRoles('admin'), ctrl.list);
router.post('/', auth, requireRoles('admin'), validateBody(createMissionPricingRuleSchema), ctrl.create);
router.patch(
  '/:id',
  auth,
  requireRoles('admin'),
  validateBody(updateMissionPricingRuleSchema),
  ctrl.update
);
router.delete('/:id', auth, requireRoles('admin'), ctrl.remove);

module.exports = router;
