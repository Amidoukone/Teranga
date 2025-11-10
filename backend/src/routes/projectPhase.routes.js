'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/projectPhase.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

/* =========================================================
   🔹 Routes des phases de projet
========================================================= */

// ✅ Création d’une phase
// Client : autorisé (même après 1h selon logique backend)
// Admin : autorisé
router.post('/', auth, requireRoles('client', 'admin'), ctrl.create);

// ✅ Liste des phases d’un projet
// Alias 1 : /api/project-phases?projectId=123  (frontend actuel)
router.get('/', auth, requireRoles('client', 'agent', 'admin'), ctrl.listByProject);

// ✅ Alias 2 : /api/project-phases/project/:projectId  (existant)
router.get(
  '/project/:projectId',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByProject
);

// ✅ Mise à jour d’une phase
// Client (si < 1h) / Agent (toujours) / Admin (toujours)
router.put('/:id', auth, requireRoles('client', 'agent', 'admin'), ctrl.update);

// ✅ Suppression d’une phase
// Client (si < 1h) / Admin (toujours)
router.delete('/:id', auth, requireRoles('client', 'admin'), ctrl.remove);

module.exports = router;
