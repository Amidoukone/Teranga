'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/tradeCategory.controller');

// Public (docs/DEV_SPEC_TERANGA_v3.md section 3.3) : pas d'auth requise,
// simple catalogue de filières actives.
router.get('/', ctrl.list);

module.exports = router;
