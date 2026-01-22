"use strict";

const { Task, Service, User, Property } = require("../../models");
const { Op } = require("sequelize");

// 🌍 Geo scope utils (admin scoped)
let applyGeoScope = null;
let getUserGeoScope = null;
try {
  // si le fichier existe déjà dans ton projet
  // (même signature que ce qu'on a utilisé dans user.controller)
  ({ applyGeoScope, getUserGeoScope } = require("../utils/geoScope"));
} catch (_) {
  // fallback : pas bloquant, mais le scope ne sera pas appliqué
  applyGeoScope = null;
  getUserGeoScope = null;
}

// 🌍 Labels FR
const {
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  SERVICE_TYPES,
  SERVICE_STATUSES,
  getLabel,
} = require("../utils/labels");

/* ============================================================
   🧩 Helpers généraux
============================================================ */
function toSafeInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function toTrimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toNullableNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getPagination(req, defaultLimit = 50, maxLimit = 200) {
  const rawL = parseInt(req.query?.limit, 10);
  const rawO = parseInt(req.query?.offset, 10);
  const limit = Number.isFinite(rawL)
    ? Math.min(Math.max(rawL, 1), maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(rawO) ? Math.max(rawO, 0) : 0;
  return { limit, offset };
}

/**
 * ✅ Admin global vs admin scoped
 * - admin global : role=admin ET (countryId/regionId NULL)
 * - admin scoped : role=admin avec countryId/regionId renseignés
 */
function isGlobalAdmin(user) {
  if (!user) return false;
  if (user.role !== "admin") return false;
  const c = user.countryId ?? null;
  const r = user.regionId ?? null;
  return c == null && r == null;
}

/**
 * ✅ Vérifie qu'une ressource est dans le scope geo du user (admin scoped)
 * - priorité région
 * - fallback pays
 */
function canAccessByGeoScope(user, resource) {
  if (!user) return false;
  if (isGlobalAdmin(user)) return true;
  if (user.role !== "admin") return true; // autres rôles: pas de scope
  const scope = getUserGeoScope
    ? getUserGeoScope(user)
    : { countryId: toSafeInt(user.countryId), regionId: toSafeInt(user.regionId) };

  const resRegion = toSafeInt(resource?.regionId ?? resource?.region_id);
  const resCountry = toSafeInt(resource?.countryId ?? resource?.country_id);

  if (scope.regionId) return resRegion != null && String(resRegion) === String(scope.regionId);
  if (scope.countryId) return resCountry != null && String(resCountry) === String(scope.countryId);
  return false;
}

/* ============================================================
   🧩 Includes réutilisables
============================================================ */
const BASE_INCLUDES = [
  {
    model: User,
    as: "creator",
    attributes: ["id", "firstName", "lastName", "email"],
  },
  {
    model: User,
    as: "assignee",
    attributes: ["id", "firstName", "lastName", "email"],
    required: false,
  },
  {
    model: Service,
    as: "service",
    required: false,
    attributes: [
      "id",
      "title",
      "type",
      "status",
      "budget",
      "clientId",
      "agentId",
      "propertyId",
      "countryId",
      "regionId",
    ],
    include: [
      {
        model: User,
        as: "client",
        attributes: ["id", "firstName", "lastName", "email"],
      },
      {
        model: User,
        as: "agent",
        attributes: ["id", "firstName", "lastName", "email"],
      },
      {
        model: Property,
        as: "property",
        attributes: ["id", "title", "city", "address", "ownerId", "countryId", "regionId"],
      },
    ],
  },
  {
    model: Property,
    as: "property",
    required: false,
    attributes: ["id", "title", "city", "address", "ownerId", "photos", "countryId", "regionId"],
  },
];

/* ============================================================
   🏷️ Labels FR
============================================================ */
function addLabels(task) {
  if (!task) return null;
  const t = task.toJSON ? task.toJSON() : task;

  return {
    ...t,
    typeLabel: getLabel(t.type, TASK_TYPES),
    priorityLabel: getLabel(t.priority, TASK_PRIORITIES),
    statusLabel: getLabel(t.status, TASK_STATUSES),
    service: t.service
      ? {
          ...t.service,
          statusLabel: getLabel(t.service.status, SERVICE_STATUSES),
          typeLabel: getLabel(t.service.type, SERVICE_TYPES),
        }
      : null,
  };
}

/* ============================================================
   🟢 CREATE TASK
   - Héritage Service → Property → Pays/Région
   - Scope: admin scoped ne peut créer que dans son scope (si scope existe)
============================================================ */
exports.create = async (req, res) => {
  try {
    const {
      serviceId,
      propertyId,
      title,
      type,
      description,
      priority,
      dueDate,
      estimatedCost,
      assignedTo,
    } = req.body || {};

    if (!title || !type) {
      return res.status(400).json({ error: "Titre et type requis" });
    }

    const sid = toSafeInt(serviceId);
    let pid = propertyId ? toSafeInt(propertyId) : null;

    let service = null;
    if (sid) {
      service = await Service.findByPk(sid, {
        attributes: ["id", "propertyId", "countryId", "regionId", "clientId", "agentId"],
      });
      if (!pid && service) pid = service.propertyId || null;
    }

    const property = pid
      ? await Property.findByPk(pid, {
          attributes: ["id", "ownerId", "countryId", "regionId"],
        })
      : null;

    const geoCountryId = service?.countryId ?? property?.countryId ?? null;
    const geoRegionId = service?.regionId ?? property?.regionId ?? null;

    // 🌍 Scope admin scoped
    if (req.user.role === "admin" && !isGlobalAdmin(req.user)) {
      const pseudo = { countryId: geoCountryId, regionId: geoRegionId };
      if (!canAccessByGeoScope(req.user, pseudo)) {
        return res.status(403).json({ error: "Création hors scope géographique" });
      }
    }

    const created = await Task.create({
      serviceId: sid || null,
      propertyId: pid || null,
      creatorId: req.user.id,
      assignedTo: assignedTo ? toSafeInt(assignedTo) : null,
      title: String(title).trim(),
      type: String(type).trim(),
      description: toTrimOrNull(description),
      priority: priority || "normal",
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedCost: toNullableNumber(estimatedCost),
      status: "created",
      countryId: geoCountryId,
      regionId: geoRegionId,
    });

    const full = await Task.findByPk(created.id, { include: BASE_INCLUDES });

    return res.status(201).json({
      message: "Tâche créée",
      task: addLabels(full),
    });
  } catch (e) {
    console.error("❌ Erreur création tâche:", e);
    return res.status(500).json({
      error: e.message || "Erreur lors de la création de la tâche",
    });
  }
};

/* ============================================================
   🟡 LIST TASKS
   - ACL existante conservée
   - + GeoScope admin scoped (filtre sur Task.countryId/regionId)
============================================================ */
exports.list = async (req, res) => {
  try {
    const { limit, offset } = getPagination(req);

    let where = {};

    if (req.query.serviceId) where.serviceId = toSafeInt(req.query.serviceId);
    if (req.query.assignedTo) where.assignedTo = toSafeInt(req.query.assignedTo);
    if (req.query.status) where.status = String(req.query.status).trim();
    if (req.query.type) where.type = String(req.query.type).trim();
    if (req.query.priority) where.priority = String(req.query.priority).trim();

    // ACL métier existante (inchangée)
    if (req.user.role === "agent") {
      where[Op.or] = [
        { assignedTo: req.user.id },
        { "$service.agentId$": req.user.id },
      ];
    } else if (req.user.role === "client") {
      where[Op.or] = [
        { creatorId: req.user.id },
        { "$service.clientId$": req.user.id },
        { "$property.ownerId$": req.user.id },
      ];
    }

    // 🌍 GeoScope (admin scoped)
    if (applyGeoScope) {
      where = applyGeoScope(where, req.user);
    } else if (req.user.role === "admin" && !isGlobalAdmin(req.user)) {
      // fallback minimal si geoScope util absent
      const c = toSafeInt(req.user.countryId);
      const r = toSafeInt(req.user.regionId);
      if (r) where.regionId = r;
      else if (c) where.countryId = c;
      else where.id = 0; // aucun scope défini -> rien
    }

    const tasks = await Task.findAll({
      where,
      include: BASE_INCLUDES,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      subQuery: false,
    });

    return res.json({
      tasks: tasks.map(addLabels),
      pagination: { limit, offset, count: tasks.length },
    });
  } catch (e) {
    console.error("❌ Erreur list tasks:", e);
    return res.status(500).json({
      error: "Erreur lors de la récupération des tâches",
    });
  }
};

/* ============================================================
   🔹 LIST BY SERVICE
   - ACL existante conservée
   - + GeoScope via jointure Service/Property + filtre Task.countryId/regionId
============================================================ */
exports.listByService = async (req, res) => {
  try {
    const serviceId = toSafeInt(req.params.id || req.params.serviceId);
    if (!serviceId) {
      return res.status(400).json({ error: "serviceId invalide" });
    }

    let where = { serviceId };

    if (req.user.role === "agent") {
      where[Op.or] = [
        { assignedTo: req.user.id },
        { "$service.agentId$": req.user.id },
      ];
    } else if (req.user.role === "client") {
      where[Op.or] = [
        { creatorId: req.user.id },
        { "$service.clientId$": req.user.id },
      ];
    }

    // 🌍 GeoScope (admin scoped)
    if (applyGeoScope) {
      where = applyGeoScope(where, req.user);
    } else if (req.user.role === "admin" && !isGlobalAdmin(req.user)) {
      const c = toSafeInt(req.user.countryId);
      const r = toSafeInt(req.user.regionId);
      if (r) where.regionId = r;
      else if (c) where.countryId = c;
      else where.id = 0;
    }

    const tasks = await Task.findAll({
      where,
      include: BASE_INCLUDES,
      order: [["createdAt", "DESC"]],
      subQuery: false,
    });

    return res.json({ tasks: tasks.map(addLabels) });
  } catch (e) {
    console.error("❌ Erreur listByService:", e);
    return res.status(500).json({
      error: "Erreur lors de la récupération des tâches",
    });
  }
};

/* ============================================================
   🟠 UPDATE STATUS
   - ACL existante conservée
   - + GeoScope admin scoped
============================================================ */
exports.updateStatus = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const newStatus = String(req.body?.status || "").trim();

    if (!id) return res.status(400).json({ error: "ID invalide" });

    const task = await Task.findByPk(id, { include: BASE_INCLUDES });
    if (!task) return res.status(404).json({ error: "Tâche introuvable" });

    // 🌍 Scope admin scoped
    if (req.user.role === "admin" && !isGlobalAdmin(req.user)) {
      if (!canAccessByGeoScope(req.user, task)) {
        return res.status(403).json({ error: "Tâche hors scope géographique" });
      }
    }

    // ACL existante
    if (req.user.role === "agent" && task.assignedTo !== req.user.id) {
      return res.status(403).json({ error: "Non autorisé" });
    }
    if (req.user.role === "client" && task.creatorId !== req.user.id) {
      return res.status(403).json({ error: "Non autorisé" });
    }

    const allowedTransitions = {
      created: ["in_progress"],
      in_progress: ["completed"],
      completed: ["validated"],
      validated: [],
      cancelled: [],
    };

    if (!allowedTransitions[task.status]?.includes(newStatus)) {
      return res.status(400).json({
        error: `Transition ${task.status} → ${newStatus} non autorisée`,
      });
    }

    if (newStatus === "validated" && req.user.role !== "admin") {
      // admin scoped ne valide pas si tu veux garder "admin only"
      return res.status(403).json({
        error: "Seul un admin peut valider une tâche",
      });
    }

    await task.update({ status: newStatus });

    const updated = await Task.findByPk(task.id, { include: BASE_INCLUDES });

    return res.json({
      message: "Statut mis à jour",
      task: addLabels(updated),
    });
  } catch (e) {
    console.error("❌ Erreur updateStatus:", e);
    return res.status(500).json({
      error: "Erreur lors de la mise à jour du statut",
    });
  }
};

/* ============================================================
   🟣 ASSIGN AGENT (ADMIN)
   - admin global : OK
   - admin scoped : OK dans son scope
============================================================ */
exports.assignAgent = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    const agentId = toSafeInt(req.body?.agentId);

    if (!id || !agentId) {
      return res.status(400).json({
        error: "Paramètres manquants (id, agentId)",
      });
    }

    // ✅ admin peut assigner (avec scope)
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Réservé aux administrateurs",
      });
    }

    const task = await Task.findByPk(id, { include: BASE_INCLUDES });
    if (!task) return res.status(404).json({ error: "Tâche introuvable" });

    // 🌍 Scope admin scoped
    if (!isGlobalAdmin(req.user)) {
      if (!canAccessByGeoScope(req.user, task)) {
        return res.status(403).json({ error: "Tâche hors scope géographique" });
      }
    }

    if (task.status !== "created") {
      return res.status(400).json({
        error: "Impossible de réassigner une tâche déjà démarrée ou terminée",
      });
    }

    const agent = await User.findByPk(agentId);
    if (!agent || agent.role !== "agent") {
      return res.status(400).json({ error: "Agent invalide" });
    }

    // (optionnel mais recommandé) : si admin scoped, empêcher d'assigner un agent hors scope
    if (!isGlobalAdmin(req.user) && req.user.role === "admin") {
      // si ton User a countryId/regionId, on protège
      const pseudoAgent = {
        countryId: agent.countryId ?? agent.country_id ?? null,
        regionId: agent.regionId ?? agent.region_id ?? null,
      };
      // Si l'agent n'a pas de scope, on autorise (rétro-compat)
      const hasScope = pseudoAgent.countryId != null || pseudoAgent.regionId != null;
      if (hasScope && !canAccessByGeoScope(req.user, pseudoAgent)) {
        return res.status(403).json({ error: "Agent hors scope géographique" });
      }
    }

    await task.update({ assignedTo: agent.id });

    const updated = await Task.findByPk(task.id, { include: BASE_INCLUDES });

    return res.json({
      message: "Tâche assignée avec succès",
      task: addLabels(updated),
    });
  } catch (e) {
    console.error("❌ Erreur assignAgent:", e);
    return res.status(500).json({
      error: "Erreur lors de l'assignation de la tâche",
    });
  }
};
