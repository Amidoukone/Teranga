'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

// Toutes les notifications (tous rôles connectés)
router.get('/', auth, requireRoles('client', 'agent', 'admin'), ctrl.list);

// Résumé (badge/counts)
router.get('/summary', auth, requireRoles('client', 'agent', 'admin'), ctrl.summary);

// Marquer une notification comme lue
router.patch(
  '/:id/read',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.markRead
);

// Marquer toutes comme lues
router.patch(
  '/read-all',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.markAllRead
);

// Nettoyage ciblé du fil (par filtres)
router.delete(
  '/cleanup',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.cleanup
);

// Supprimer une notification du fil utilisateur
router.delete(
  '/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.removeOne
);

module.exports = router;
