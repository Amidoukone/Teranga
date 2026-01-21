'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/projectPhase.controller');
const auth = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/roles.middleware');

/* =========================================================
   🔹 Routes des phases de projet
   - ACL fines (1h client / admin) sont appliquées dans le controller.
   - "Master" = admin + scope GEO : géré dans les contrôleurs (pas ici).
========================================================= */

/**
 * Helper: injecte projectId depuis params dans query/body
 * (non destructif, améliore compat frontend + contrôleur)
 */
function injectProjectId(req, _res, next) {
  const pid = req.params?.projectId;
  if (pid != null) {
    // Certains contrôleurs lisent req.query.projectId
    req.query = req.query || {};
    if (req.query.projectId == null) req.query.projectId = pid;

    // Certains flux peuvent poster sur un alias (rare), mais safe
    req.body = req.body || {};
    if (req.body.projectId == null) req.body.projectId = pid;
  }
  next();
}

/* =========================
   ✅ Créer une phase
   - Client / Admin (règle 1h côté controller)
========================= */
router.post('/', auth, requireRoles('client', 'admin'), ctrl.create);

/* =========================
   ✅ Liste des phases
   - Alias 1 : /api/project-phases?projectId=123
========================= */
router.get(
  '/',
  auth,
  requireRoles('client', 'agent', 'admin'),
  ctrl.listByProject
);

/* =========================
   ✅ Alias 2 : /api/project-phases/project/:projectId
========================= */
router.get(
  '/project/:projectId',
  auth,
  requireRoles('client', 'agent', 'admin'),
  injectProjectId,
  ctrl.listByProject
);

/* =========================
   ✅ Mise à jour
   - Client/Admin uniquement (selon ton controller actuel)
   ⚠️ Important: ton controller ne donne PAS d’accès agent.
   Si tu veux “agent toujours”, il faut modifier le controller.
========================= */
router.put('/:id', auth, requireRoles('client', 'admin'), ctrl.update);

/* =========================
   ✅ Suppression
   - Client/Admin (règle 1h côté controller)
========================= */
router.delete('/:id', auth, requireRoles('client', 'admin'), ctrl.remove);

module.exports = router;
