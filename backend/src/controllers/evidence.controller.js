"use strict";

const { Evidence, Task, Service, Property, User, Order } = require("../../models");
const { Op } = require("sequelize");
const imagekit = require("../helpers/teranga-imagekit");

// 🌍 Labels
const { EVIDENCE_KINDS, getLabel } = require("../utils/labels");

// ✅ GeoScope (admin scoped)
const geo = require("../utils/geoScope");
const applyGeoScope = geo.applyGeoScope;
const getUserGeoScope = geo.getUserGeoScope;
const isGlobalAdmin =
  geo.isGlobalAdmin ||
  ((u) => u?.role === "admin" && !(u?.countryId || u?.regionId));

/* ======================================================
   🧩 Helpers utilitaires
====================================================== */
function toSafeInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function guessKind(mime) {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "photo";
  if (mime === "application/pdf") return "document";
  return "other";
}

function addLabels(evidence) {
  if (!evidence) return null;
  const e = evidence.toJSON ? evidence.toJSON() : evidence;

  let uploaderName = null;
  if (e.uploader) {
    const fn = e.uploader.firstName || e.uploader.firstname || "";
    const ln = e.uploader.lastName || e.uploader.lastname || "";
    const full = `${fn} ${ln}`.trim();
    uploaderName = full || e.uploader.email || null;
  }

  return {
    ...e,
    kindLabel: getLabel(e.kind, EVIDENCE_KINDS),
    uploaderName,
  };
}

/* ======================================================
   🌍 Scope helpers (source de vérité = resource liée)
====================================================== */
function getScopeFromResource(resource) {
  if (!resource) return { countryId: null, regionId: null };
  return {
    countryId: toSafeInt(resource.countryId ?? resource.country_id),
    regionId: toSafeInt(resource.regionId ?? resource.region_id),
  };
}

function canAccessGeoScope(user, resource) {
  if (!user) return false;

  // Admin global => OK
  if (isGlobalAdmin(user)) return true;

  // Client/agent/admin scoped => vérifier via scope user
  const scope = getUserGeoScope ? getUserGeoScope(user) : { countryId: null, regionId: null };
  const r = getScopeFromResource(resource);

  // Si resource n'a pas de scope => on autorise pour rétro-compat (legacy)
  if (!r.countryId && !r.regionId) return true;

  if (scope.regionId) return String(r.regionId) === String(scope.regionId);
  if (scope.countryId) return String(r.countryId) === String(scope.countryId);

  // user sans scope => considéré global (mais normalement admin global déjà catch)
  return true;
}

/* ======================================================
   🔐 ACL — Tâches
====================================================== */
async function loadTaskForAcl(taskId) {
  if (!taskId) return null;

  const task = await Task.findByPk(taskId);
  if (!task) return null;

  const t = task.toJSON ? task.toJSON() : task;

  if (t.serviceId) {
    const svc = await Service.findByPk(t.serviceId, {
      attributes: ["id", "clientId", "agentId", "countryId", "regionId"],
    });
    t.service = svc ? (svc.toJSON ? svc.toJSON() : svc) : null;
  }

  if (t.propertyId) {
    const prop = await Property.findByPk(t.propertyId, {
      attributes: ["id", "ownerId", "countryId", "regionId"],
    });
    t.property = prop ? (prop.toJSON ? prop.toJSON() : prop) : null;
  }

  return t;
}

function canAccessTask(user, task) {
  if (!user || !task) return false;

  // ✅ Admin global => OK
  if (isGlobalAdmin(user)) return true;

  // ✅ Admin scoped => autorisé mais limité par scope geo
  if (user.role === "admin") return canAccessGeoScope(user, task);

  if (user.role === "agent") {
    // ACL métier existante
    let ok = false;
    if (task.assignedTo === user.id) ok = true;
    if (task.service && task.service.agentId === user.id) ok = true;

    // ✅ + scope geo
    return ok && canAccessGeoScope(user, task.service || task.property || task);
  }

  if (user.role === "client") {
    // ACL métier existante
    let ok = false;
    if (task.creatorId === user.id) ok = true;
    if (task.service && task.service.clientId === user.id) ok = true;
    if (task.property && task.property.ownerId === user.id) ok = true;

    // Client: ne force pas scope (rétro-compat) mais si task scoped => ok
    return ok;
  }

  return false;
}

/* ======================================================
   🔐 ACL — Commandes
====================================================== */
async function loadOrderForAcl(orderId) {
  if (!orderId) return null;
  return Order.findByPk(orderId);
}

function canAccessOrder(user, order) {
  if (!user || !order) return false;

  // ✅ Admin global => OK
  if (isGlobalAdmin(user)) return true;

  // ✅ Admin scoped => autorisé mais limité par scope geo
  if (user.role === "admin") return canAccessGeoScope(user, order);

  const uid = String(user.id);

  if (user.role === "client") {
    return String(order.userId) === uid || String(order.clientId) === uid;
  }

  if (user.role === "agent") {
    const ok = String(order.agentId) === uid;
    return ok && canAccessGeoScope(user, order);
  }

  return false;
}

/* ======================================================
   🧰 Normalisation fichiers (multer)
====================================================== */
function normalizeUploadedFiles(req) {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;

  if (req.files && typeof req.files === "object") {
    const out = [];
    for (const arr of Object.values(req.files)) {
      if (Array.isArray(arr)) out.push(...arr);
    }
    return out;
  }
  return [];
}

/* ======================================================
   📸 CREATE — Ajout de preuves (multi-pays SAFE)
====================================================== */
exports.create = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const bodyTaskId = toSafeInt(req.body?.taskId);
    const bodyOrderId = toSafeInt(req.body?.orderId);
    const paramId = toSafeInt(req.params?.id);
    const ctx = (req.baseUrl || req.originalUrl || "").toLowerCase();

    let taskId = bodyTaskId;
    let orderId = bodyOrderId;

    if (!taskId && !orderId && paramId) {
      if (ctx.includes("/tasks/")) taskId = paramId;
      else if (ctx.includes("/orders/")) orderId = paramId;
    }

    const notes = req.body?.notes || null;
    if (!taskId && !orderId) {
      return res.status(400).json({ error: "taskId ou orderId requis" });
    }

    let task = null;
    let order = null;

    if (taskId) {
      task = await loadTaskForAcl(taskId);
      if (!task) return res.status(404).json({ error: "Tâche introuvable" });
      if (!canAccessTask(req.user, task)) {
        return res.status(403).json({ error: "Accès interdit pour cette tâche" });
      }
    }

    if (orderId) {
      order = await loadOrderForAcl(orderId);
      if (!order) return res.status(404).json({ error: "Commande introuvable" });
      if (!canAccessOrder(req.user, order)) {
        return res.status(403).json({ error: "Accès interdit pour cette commande" });
      }
    }

    const files = normalizeUploadedFiles(req);
    if (!files.length) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    // 🌍 Héritage strict depuis la ressource liée (Task/Order)
    const geoCountryId = toSafeInt(task?.countryId ?? order?.countryId) ?? null;
    const geoRegionId = toSafeInt(task?.regionId ?? order?.regionId) ?? null;

    // ✅ Si utilisateur scoped : il doit matcher le scope de la ressource liée
    if (!isGlobalAdmin(req.user)) {
      const linked = task || order;
      if (linked && !canAccessGeoScope(req.user, linked)) {
        return res.status(403).json({ error: "Ressource hors scope (accès interdit)" });
      }
    }

    const created = [];

    for (const f of files) {
      const uploaded = await imagekit.upload({
        file: f.buffer,
        fileName: `evidence_${Date.now()}_${f.originalname}`,
        folder: "/teranga/evidences/",
      });

      const record = await Evidence.create({
        taskId: task ? task.id || task.taskId || taskId : null,
        orderId: order ? order.id || order.orderId || orderId : null,
        uploaderId: req.user.id,
        kind: guessKind(f.mimetype),
        mimeType: f.mimetype || null,
        originalName: f.originalname || null,
        filePath: uploaded.url,
        fileId: uploaded.fileId,
        fileSize: f.size || null,
        thumbnailPath: null,
        notes,

        // 🌍 multi-pays (héritage strict)
        countryId: geoCountryId,
        regionId: geoRegionId,
      });

      created.push(record);
    }

    const withIncludes = await Evidence.findAll({
      where: { id: { [Op.in]: created.map((c) => c.id) } },
      include: [
        {
          model: User,
          as: "uploader",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(201).json({
      message: "Preuve(s) ajoutée(s) avec succès",
      evidences: withIncludes.map(addLabels),
    });
  } catch (e) {
    console.error("❌ Erreur create evidence:", e);
    return res.status(500).json({ error: "Erreur lors de l'ajout des preuves" });
  }
};
/* ======================================================
   📋 LIST — avec ACL + scope géographique
   GET /evidences?taskId=...&orderId=...
====================================================== */
exports.list = async (req, res) => {
  try {
    const taskId = toSafeInt(req.query?.taskId);
    const orderId = toSafeInt(req.query?.orderId);

    // ⚠️ Sécurité : hors admin global, il faut un contexte
    if (!isGlobalAdmin(req.user) && !taskId && !orderId) {
      return res.status(400).json({
        error: "taskId ou orderId requis pour ce rôle",
      });
    }

    const where = {};

    if (taskId) {
      const task = await loadTaskForAcl(taskId);
      if (!task) return res.status(404).json({ error: "Tâche introuvable" });
      if (!canAccessTask(req.user, task)) {
        return res.status(403).json({ error: "Accès interdit pour cette tâche" });
      }
      where.taskId = taskId;
    }

    if (orderId) {
      const order = await loadOrderForAcl(orderId);
      if (!order) return res.status(404).json({ error: "Commande introuvable" });
      if (!canAccessOrder(req.user, order)) {
        return res.status(403).json({ error: "Accès interdit pour cette commande" });
      }
      where.orderId = orderId;
    }

    // 🌍 Filtrage géographique (admin scoped)
    const finalWhere = applyGeoScope
      ? applyGeoScope(where, req.user)
      : where;

    const evidences = await Evidence.findAll({
      where: finalWhere,
      include: [
        {
          model: User,
          as: "uploader",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error("❌ Erreur list evidences:", e);
    return res.status(500).json({
      error: "Erreur lors de la récupération des preuves",
    });
  }
};

/* ======================================================
   📂 LIST BY TASK — GET /tasks/:id/evidences
====================================================== */
exports.listByTask = async (req, res) => {
  try {
    const taskId = toSafeInt(req.params?.id || req.params?.taskId);
    if (!taskId) {
      return res.status(400).json({ error: "ID de tâche invalide" });
    }

    const task = await loadTaskForAcl(taskId);
    if (!task) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }
    if (!canAccessTask(req.user, task)) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const where = applyGeoScope
      ? applyGeoScope({ taskId }, req.user)
      : { taskId };

    const evidences = await Evidence.findAll({
      where,
      include: [
        {
          model: User,
          as: "uploader",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error("❌ Erreur listByTask:", e);
    return res.status(500).json({
      error: "Erreur lors de la récupération des preuves",
    });
  }
};

/* ======================================================
   🔹 LIST BY ORDER — GET /orders/:id/evidences
====================================================== */
exports.listByOrder = async (req, res) => {
  try {
    const orderId = toSafeInt(req.params?.id || req.params?.orderId);
    if (!orderId) {
      return res.status(400).json({ error: "ID de commande invalide" });
    }

    const order = await loadOrderForAcl(orderId);
    if (!order) {
      return res.status(404).json({ error: "Commande introuvable" });
    }
    if (!canAccessOrder(req.user, order)) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const where = applyGeoScope
      ? applyGeoScope({ orderId }, req.user)
      : { orderId };

    const evidences = await Evidence.findAll({
      where,
      include: [
        {
          model: User,
          as: "uploader",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ evidences: evidences.map(addLabels) });
  } catch (e) {
    console.error("❌ Erreur listByOrder:", e);
    return res.status(500).json({
      error: "Erreur lors de la récupération des preuves",
    });
  }
};

/* ======================================================
   🗑️ DELETE — admin global / admin scoped (scope)
   DELETE /evidences/:id
====================================================== */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params?.id);
    if (!id) {
      return res.status(400).json({ error: "ID invalide" });
    }

    const ev = await Evidence.findByPk(id, {
      include: [
        {
          model: User,
          as: "uploader",
          attributes: ["id", "email", "role"],
        },
        { model: Task, as: "task" },
        { model: Order, as: "order" },
      ],
    });

    if (!ev) {
      return res.status(404).json({ error: "Preuve introuvable" });
    }

    // 🔐 ACL suppression
    if (isGlobalAdmin(req.user)) {
      // OK
    } else if (req.user.role === "admin") {
      const linked = ev.task || ev.order;
      if (linked && !canAccessGeoScope(req.user, linked)) {
        return res.status(403).json({ error: "Suppression hors scope interdite" });
      }
    } else {
      return res.status(403).json({
        error: "Suppression réservée à un administrateur.",
      });
    }

    // 🗑️ Suppression ImageKit
    if (ev.fileId) {
      try {
        await imagekit.deleteFile(ev.fileId);
      } catch (e) {
        console.warn(
          "⚠️ Impossible de supprimer le fichier ImageKit:",
          e.message
        );
      }
    }

    await ev.destroy();

    return res.json({ message: "Preuve supprimée avec succès" });
  } catch (e) {
    console.error("❌ Erreur remove evidence:", e);
    return res.status(500).json({
      error: "Erreur lors de la suppression du fichier",
    });
  }
};
