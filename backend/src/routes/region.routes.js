'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/region.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

/**
 * ============================================================
 * 🗺️ Routes Régions (Regions)
 * ============================================================
 * - GET  /regions : liste des régions (auth requis)
 * - POST /regions : création (admin)
 * - PUT  /regions/:id : update (admin)
 * ============================================================
 */

// Liste (tous rôles authentifiés)
router.get('/', auth, ctrl.list);

// Admin uniquement
router.post('/', auth, requireRoles('admin'), ctrl.create);
router.put('/:id', auth, requireRoles('admin'), ctrl.update);

module.exports = router;
