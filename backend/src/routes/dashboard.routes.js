'use strict';

const router = require('express').Router();

const ctrl = require('../controllers/dashboard.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

router.get(
  '/summary',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.summary
);

module.exports = router;

