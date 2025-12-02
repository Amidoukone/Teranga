"use strict";

const { Evidence, Task, Service, Property, User, Order } = require("../../models");
const { Op } = require("sequelize");
const imagekit = require("../helpers/teranga-imagekit");

// 🌍 Labels
const { EVIDENCE_KINDS, getLabel } = require("../utils/labels");

/* ======================================================
   🧩 Helpers utilitaires
====================================================== */
function toSafeInt(v) {
  if (v === null || v === undefined) return null;
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
   🔐 ACL — Tâches (version robuste, sans gros include)
====================================================== */
async function loadTaskForAcl(taskId) {
  if (!taskId) return null;

  const task = await Task.findByPk(taskId);
  if (!task) return null;

  const t = task.toJSON();

  // On attache minimalement service / property pour l’ACL
  if (t.serviceId) {
    const svc = await Service.findByPk(t.serviceId, {
      attributes: ["id", "clientId", "agentId"],
    });
    t.service = svc ? (svc.toJSON ? svc.toJSON() : svc) : null;
  }

  if (t.propertyId) {
    const prop = await Property.findByPk(t.propertyId, {
      attributes: ["id", "ownerId"],
    });
    t.property = prop ? (prop.toJSON ? prop.toJSON() : prop) : null;
  }

  return t;
}

function canAccessTask(user, task) {
  if (!user || !task) return false;
  if (user.role === "admin") return true;

  // Agent
  if (user.role === "agent") {
    if (task.assignedTo === user.id) return true;
    if (task.service && task.service.agentId === user.id) return true;
    return false;
  }

  // Client
  if (user.role === "client") {
    if (task.creatorId === user.id) return true;
    if (task.service && task.service.clientId === user.id) return true;
    if (task.property && task.property.ownerId === user.id) return true;
    return false;
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
  if (user.role === "admin") return true;

  const uid = String(user.id);
  const oUser = order.userId != null ? String(order.userId) : null;
  const oClient = order.clientId != null ? String(order.clientId) : null;
  const oAgent = order.agentId != null ? String(order.agentId) : null;

  if (user.role === "client") {
    return oUser === uid || oClient === uid;
  }

  if (user.role === "agent") {
    return oAgent === uid;
  }

  return false;
}

/* ======================================================
   🧰 Normalisation des fichiers envoyés (multer)
====================================================== */
function normalizeUploadedFiles(req) {
  // single
  if (req.file) return [req.file];

  // array
  if (Array.isArray(req.files)) return req.files;

  // fields
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
   📸 CREATE — Ajout de preuves (ImageKit)
   Compatible avec :
   - POST /tasks/:id/evidences
   - POST /orders/:id/evidences
   - POST /evidences (body: taskId / orderId)
====================================================== */
exports.create = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    // 🔑 Id provenant soit du body, soit de l'URL
    const bodyTaskId = toSafeInt(req.body?.taskId);
    const bodyOrderId = toSafeInt(req.body?.orderId);

    const paramId = toSafeInt(req.params?.id); // ex: /tasks/:id/evidences ou /orders/:id/evidences
    const paramContext = (req.baseUrl || req.originalUrl || "").toLowerCase();

    let taskId = bodyTaskId;
    let orderId = bodyOrderId;

    if (!taskId && !orderId && paramId) {
      if (paramContext.includes("/tasks/")) {
        taskId = paramId;
      } else if (paramContext.includes("/orders/")) {
        orderId = paramId;
      }
    }

    const notes = req.body?.notes || null;

    if (!taskId && !orderId) {
      return res
        .status(400)
        .json({ error: "taskId ou orderId requis (URL ou body)" });
    }

    let task = null;
    let order = null;

    // 🔐 ACL via tâche
    if (taskId) {
      task = await loadTaskForAcl(taskId);
      if (!task) {
        return res.status(404).json({ error: "Tâche introuvable" });
      }
      if (!canAccessTask(req.user, task)) {
        return res
          .status(403)
          .json({ error: "Accès interdit pour cette tâche" });
      }
    }

    // 🔐 ACL via commande
    if (orderId) {
      order = await loadOrderForAcl(orderId);
      if (!order) {
        return res.status(404).json({ error: "Commande introuvable" });
      }
      if (!canAccessOrder(req.user, order)) {
        return res
          .status(403)
          .json({ error: "Accès interdit pour cette commande" });
      }
    }

    const files = normalizeUploadedFiles(req);
    if (!files.length) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    const created = [];

    for (const f of files) {
      // 🚀 Upload vers ImageKit
      const uploaded = await imagekit.upload({
        file: f.buffer, // buffer (multer memoryStorage)
        fileName: `evidence_${Date.now()}_${f.originalname}`,
        folder: "/teranga/evidences/",
      });

      const record = await Evidence.create({
        taskId: task ? task.id || task.taskId || taskId : taskId || null,
        orderId: order ? order.id || order.orderId || orderId : orderId || null,
        uploaderId: req.user.id,
        kind: guessKind(f.mimetype),
        mimeType: f.mimetype || null,
        originalName: f.originalname || null,
        filePath: uploaded.url, // URL publique ImageKit
        fileId: uploaded.fileId, // pour suppression ultérieure
        fileSize: f.size || null,
        thumbnailPath: null,
        notes,
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
    return res
      .status(500)
      .json({ error: "Erreur lors de l'ajout des preuves" });
  }
};

/* ======================================================
   📋 LIST — avec ACL, utilisé notamment par admin
   /evidences?taskId=...&orderId=...
====================================================== */
exports.list = async (req, res) => {
  try {
    const taskId = toSafeInt(req.query?.taskId);
    const orderId = toSafeInt(req.query?.orderId);

    if (req.user.role !== "admin" && !taskId && !orderId) {
      return res.status(400).json({
        error: "taskId ou orderId requis pour ce rôle",
      });
    }

    const where = {};

    if (taskId) {
      const task = await loadTaskForAcl(taskId);
      if (!task)
        return res.status(404).json({ error: "Tâche introuvable" });
      if (!canAccessTask(req.user, task))
        return res
          .status(403)
          .json({ error: "Accès interdit pour cette tâche" });
      where.taskId = taskId;
    }

    if (orderId) {
      const order = await loadOrderForAcl(orderId);
      if (!order)
        return res.status(404).json({ error: "Commande introuvable" });
      if (!canAccessOrder(req.user, order))
        return res
          .status(403)
          .json({ error: "Accès interdit pour cette commande" });
      where.orderId = orderId;
    }

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
    if (!taskId)
      return res.status(400).json({ error: "ID de tâche invalide" });

    const task = await loadTaskForAcl(taskId);
    if (!task)
      return res.status(404).json({ error: "Tâche introuvable" });
    if (!canAccessTask(req.user, task))
      return res.status(403).json({ error: "Accès interdit" });

    const evidences = await Evidence.findAll({
      where: { taskId },
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
    if (!orderId)
      return res.status(400).json({ error: "ID de commande invalide" });

    const order = await loadOrderForAcl(orderId);
    if (!order)
      return res.status(404).json({ error: "Commande introuvable" });
    if (!canAccessOrder(req.user, order))
      return res.status(403).json({ error: "Accès interdit" });

    const evidences = await Evidence.findAll({
      where: { orderId },
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
   🗑️ DELETE — admin uniquement + suppression ImageKit
   DELETE /evidences/:id
====================================================== */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params?.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const ev = await Evidence.findByPk(id, {
      include: [
        {
          model: User,
          as: "uploader",
          attributes: ["id", "email", "role"],
        },
        {
          model: Task,
          as: "task",
        },
      ],
    });

    if (!ev)
      return res.status(404).json({ error: "Preuve introuvable" });

    if (req.user.role !== "admin") {
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
