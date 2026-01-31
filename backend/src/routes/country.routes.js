'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/country.controller');
const auth = require('../middleware/auth.middleware');
const { requireGlobalAdmin } = require('../middleware/roles.middleware');

/**
 * ============================================================
 * 🌍 Routes Pays (Countries)
 * ============================================================
 * - GET  /countries : liste des pays (auth requis)
 *   • admin: peut ajouter ?includeInactive=true (géré dans le contrôleur)
 * - POST /countries : création (admin)
 * - PUT  /countries/:id : update (admin)
 * - DELETE /countries/:id : suppression (admin)
 * ============================================================
 */

// Liste (tous rôles authentifiés)
router.get('/', auth, ctrl.list);

// Admin uniquement
router.post('/', auth, requireGlobalAdmin, ctrl.create);
router.put('/:id', auth, requireGlobalAdmin, ctrl.update);
router.delete('/:id', auth, requireGlobalAdmin, ctrl.remove);

module.exports = router;
