"use strict";

const router = require("express").Router();
const ctrl = require("../controllers/activity.controller");
const auth = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/roles.middleware");
const { writeLimiter } = require('../middleware/rateLimit.middleware');
// Même liste que notification.routes.js : ce fil est aussi "tous rôles connectés", y
// compris provider/category_manager (absents ici par oubli lors de leur ajout).
const personalRoles = ["client", "agent", "admin", "provider", "category_manager"];

// Toutes les activites (tous roles connectes)
router.get("/", auth, requireRoles(...personalRoles), ctrl.list);

// Nettoyage cible du fil (par filtres)
router.delete(
  "/cleanup",
  auth,
  requireRoles(...personalRoles),
  writeLimiter,
  ctrl.cleanup
);

// Supprimer une activite du fil utilisateur
router.delete(
  "/:id",
  auth,
  requireRoles(...personalRoles),
  writeLimiter,
  ctrl.removeOne
);

module.exports = router;
