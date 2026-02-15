"use strict";

const router = require("express").Router();
const ctrl = require("../controllers/activity.controller");
const auth = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/roles.middleware");

// Toutes les activitÃ©s (tous rÃ´les connectÃ©s)
router.get("/", auth, requireRoles("client", "agent", "admin"), ctrl.list);

module.exports = router;
