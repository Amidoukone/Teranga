'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/property.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const upload = require('../middleware/uploadProperties.middleware');
const logger = require('../utils/logger');

function attachOwnerIdFromParam(req, _res, next) {
  req.body = req.body || {};
  req.body.ownerId = req.params.id;
  next();
}

router.post(
  '/',
  auth,
  requireRoles('client', 'admin'),
  upload.array('files', 5),
  ctrl.create
);

router.get(
  '/',
  auth,
  requireRoles('client', 'admin'),
  ctrl.list
);

router.put(
  '/:id',
  auth,
  requireRoles('client', 'admin'),
  upload.array('files', 5),
  ctrl.update
);

router.delete(
  '/:id',
  auth,
  requireRoles('client', 'admin'),
  ctrl.remove
);

router.post(
  '/client/:id',
  auth,
  requireRoles('admin'),
  upload.array('files', 5),
  attachOwnerIdFromParam,
  (req, res, next) => {
    logger.info(
      {
        route: '/properties/client/:id',
        clientId: req.params.id,
        filesCount: (req.files || []).length,
      },
      'property.route.admin_create_by_client.used'
    );
    return ctrl.create(req, res, next);
  }
);

router.post(
  '/admin',
  auth,
  requireRoles('admin'),
  upload.array('files', 5),
  (req, res, next) => {
    const { ownerId, clientId, ownerEmail } = req.body || {};
    logger.info(
      {
        route: '/properties/admin',
        ownerId,
        clientId,
        ownerEmail,
        filesCount: (req.files || []).length,
      },
      'property.route.admin_create.used'
    );
    return ctrl.create(req, res, next);
  }
);

router.get(
  '/client/:id',
  auth,
  requireRoles('admin'),
  ctrl.listByClient
);

router.get(
  '/by-owner/:id',
  auth,
  requireRoles('admin'),
  ctrl.listByClient
);

router.post(
  '/create',
  auth,
  requireRoles('client', 'admin'),
  upload.array('files', 5),
  (req, res, next) => {
    logger.info(
      { route: '/properties/create' },
      'property.route.compat_create.used'
    );
    return ctrl.create(req, res, next);
  }
);

router.post(
  '/admin/create',
  auth,
  requireRoles('admin'),
  upload.array('files', 5),
  (req, res, next) => {
    logger.info(
      { route: '/properties/admin/create' },
      'property.route.compat_admin_create.used'
    );
    return ctrl.create(req, res, next);
  }
);

module.exports = router;
