'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
const personalRoles = ['client', 'agent', 'admin', 'provider', 'category_manager'];

// Toutes les notifications (tous rôles connectés)
router.get('/', auth, requireRoles(...personalRoles), ctrl.list);

// Résumé (badge/counts)
router.get('/summary', auth, requireRoles(...personalRoles), ctrl.summary);

// Marquer une notification comme lue
router.patch(
  '/:id/read',
  auth,
  requireRoles(...personalRoles),
  ctrl.markRead
);

// Marquer toutes comme lues
router.patch(
  '/read-all',
  auth,
  requireRoles(...personalRoles),
  ctrl.markAllRead
);

// Nettoyage ciblé du fil (par filtres)
router.delete(
  '/cleanup',
  auth,
  requireRoles(...personalRoles),
  writeLimiter,
  ctrl.cleanup
);

// Supprimer une notification du fil utilisateur
router.delete(
  '/:id',
  auth,
  requireRoles(...personalRoles),
  writeLimiter,
  ctrl.removeOne
);

module.exports = router;
