// backend/src/routes/savedLocation.routes.js
'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/savedLocation.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { validateBody } = require('../middleware/validate.middleware');
const { createSavedLocationSchema } = require('../validators/savedLocation.schemas');

/**
 * ROUTES LIEUX ENREGISTRÉS (docs/DEV_SPEC_TERANGA_v3.md section 4.1, étape 2)
 * v1-only par design (section 0.5). Liste strictement personnelle (client).
 */

router.get('/', auth, requireRoles('client'), ctrl.list);
router.post('/', auth, requireRoles('client'), validateBody(createSavedLocationSchema), ctrl.create);
router.delete('/:id', auth, requireRoles('client'), ctrl.remove);

module.exports = router;
