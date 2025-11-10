'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/projectDocument.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

// 📂 Middleware d’upload spécifique aux documents de projets
// ⚙️ Enregistre dans /uploads/projects/
const upload = require('../middleware/uploadProjects.middleware');

/* =========================================================
   🔹 Routes des documents de projet
   Compatible frontend & backend unifié
========================================================= */

// ✅ Upload multiple (champ 'files') — cohérent avec le frontend
router.post(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  upload.array('files', 10),
  ctrl.upload
);

// ✅ Alias 1 : /api/project-documents?projectId=123  (frontend actuel)
router.get(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByProject
);

// ✅ Alias 2 : /api/project-documents/project/:projectId  (existant)
router.get(
  '/project/:projectId',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByProject
);

// ✅ Suppression document
// (le contrôleur gère déjà les ACL selon le rôle et la règle des 1h)
router.delete(
  '/:id',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.remove
);

module.exports = router;
