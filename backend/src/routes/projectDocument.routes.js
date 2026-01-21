'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/projectDocument.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

// 📂 Middleware d’upload spécifique aux documents de projets
// ⚙️ Enregistre dans /uploads/projects/ (mais en memoryStorage si ImageKit)
const upload = require('../middleware/uploadProjects.middleware');

/* =========================================================
   🔹 Routes des documents de projet
   - Upload multiple: champ 'files'
   - Alias compat: query ?projectId= / path /project/:projectId
   - ACL fines (admin scoped GEO / client owner / agent assigné) gérées dans controller.
========================================================= */

/**
 * Helper: injecte projectId depuis params dans query/body
 * (non destructif, améliore compat frontend + contrôleur)
 */
function injectProjectId(req, _res, next) {
  const pid = req.params?.projectId;
  if (pid != null) {
    req.query = req.query || {};
    if (req.query.projectId == null) req.query.projectId = pid;

    req.body = req.body || {};
    if (req.body.projectId == null) req.body.projectId = pid;
  }
  next();
}

/* =========================
   ✅ Upload documents (multi)
   - POST /api/project-documents
   - Body: projectId + files[]
========================= */
router.post(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  upload.array('files', 10),
  ctrl.upload
);

/* =========================
   ✅ Liste documents (query)
   - GET /api/project-documents?projectId=123
========================= */
router.get(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByProject
);

/* =========================
   ✅ Alias liste (path)
   - GET /api/project-documents/project/:projectId
========================= */
router.get(
  '/project/:projectId',
  auth,
  requireRoles('client', 'agent', 'admin'),
  injectProjectId,
  ctrl.listByProject
);

/* =========================
   ✅ Suppression
   - La règle métier (client <= 1h, admin scoped GEO) est dans controller
   ⚠️ Ton controller actuel ne permet PAS à l’agent de supprimer.
   Donc ici: client/admin seulement pour éviter un faux positif route->controller.
========================= */
router.delete(
  '/:id',
  auth,
  requireRoles('client', 'admin'),
  ctrl.remove
);

module.exports = router;
