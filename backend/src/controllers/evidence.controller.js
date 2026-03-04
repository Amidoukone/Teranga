"use strict";

const path = require("path");
const fs = require("fs");
const { Evidence, Task, Service, Property, User, Order } = require("../../models");
const { Op } = require("sequelize");
const imagekit = require("../helpers/teranga-imagekit");

// 🌍 Labels
const { EVIDENCE_KINDS, getLabel } = require("../utils/labels");

// ✅ GeoScope (strict + admin global)
const {
  applyGeoScopeForModel,
  canAccessGeoResource,
  isGlobalAdmin,
} = require("../utils/geoScope");
const {
  getAdminRecipientIds,
  computeProgress,
} = require("../services/notification.service");
const { emitEvent } = require("../services/activity.service");
const logger = require('../utils/logger');
const { resolveUploadsRoot } = require("../utils/uploadsRoot");
const {
  buildMediaStorageDiagnostics,
  isImageKitConfigured,
} = require("../utils/mediaStorageDiagnostics");
const { evaluateLocalMediaFallback } = require("../utils/mediaStoragePolicy");
const DELETE_WINDOW_MS = 60 * 60 * 1000;
const EVIDENCE_MEDIA_STORAGE_ERROR_CODE = "EVIDENCE_MEDIA_STORAGE_UNAVAILABLE";
const EVIDENCE_LOCAL_FALLBACK_ENV_VAR = "EVIDENCE_ALLOW_LOCAL_FALLBACK";

function toIntOr(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const EVIDENCE_MIN_IMAGES = toIntOr(process.env.EVIDENCE_MIN_IMAGES, 5);
const EVIDENCE_MAX_IMAGES = toIntOr(process.env.EVIDENCE_MAX_IMAGES, 15);
const EVIDENCE_UPLOAD_CONCURRENCY = toIntOr(
  process.env.EVIDENCE_UPLOAD_CONCURRENCY,
  3
);
const EVIDENCE_UPLOAD_RETRIES = toIntOr(
  process.env.EVIDENCE_UPLOAD_RETRIES,
  2
);
const EVIDENCE_UPLOAD_RETRY_BASE_MS = toIntOr(
  process.env.EVIDENCE_UPLOAD_RETRY_BASE_MS,
  600
);

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

async function mapWithConcurrency(items, limit, fn) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const safeLimit = Math.max(1, Math.min(limit || 1, items.length));
  const results = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: safeLimit }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

/* ======================================================
   Upload helpers (ImageKit + fallback local)
====================================================== */
function isImageKitEnabled() {
  return isImageKitConfigured(process.env);
}

function resolveLocalFallbackPolicy() {
  return evaluateLocalMediaFallback({
    moduleFallbackEnvVar: EVIDENCE_LOCAL_FALLBACK_ENV_VAR,
  });
}

function mediaStorageError() {
  const err = new Error(
    "Stockage des preuves indisponible. Configurez IMAGEKIT_* ou UPLOADS_ROOT persistant."
  );
  err.code = EVIDENCE_MEDIA_STORAGE_ERROR_CODE;
  return err;
}

function sanitizeBasename(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildEvidenceFileName(originalName, idx) {
  const base = path.basename(originalName || "file");
  const ext = path.extname(base || "").toLowerCase();
  const nameOnly = base.slice(0, base.length - ext.length);
  const safeBase = sanitizeBasename(nameOnly) || "file";
  const safeExt = ext && ext.length <= 10 ? ext : "";
  const salt = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now();
  return `evidence_${timestamp}_${salt}_${idx}_${safeBase}${safeExt}`;
}

function isRetryableError(err) {
  const code = err?.code || err?.cause?.code;
  const msg = String(err?.message || "").toLowerCase();
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNABORTED" ||
    code === "EAI_AGAIN" ||
    msg.includes("socket hang up") ||
    msg.includes("econnreset")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadToImageKitWithRetry(payload) {
  const attempts = Math.max(1, EVIDENCE_UPLOAD_RETRIES + 1);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await imagekit.upload(payload);
    } catch (err) {
      lastError = err;
      if (attempt >= attempts || !isRetryableError(err)) break;
      const waitMs = EVIDENCE_UPLOAD_RETRY_BASE_MS * attempt;
      await sleep(waitMs);
    }
  }

  throw lastError;
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function saveEvidenceLocally(file, fileName) {
  const uploadsRoot = resolveUploadsRoot();
  const evidenceDir = path.join(uploadsRoot, "evidences");
  await ensureDir(evidenceDir);

  const safeName = sanitizeBasename(fileName || file?.originalname || "file");
  const localName = safeName || buildEvidenceFileName(file?.originalname, 0);
  const absolutePath = path.join(evidenceDir, localName);

  await fs.promises.writeFile(absolutePath, file.buffer);

  return {
    url: `/uploads/evidences/${localName}`,
    fileId: null,
  };
}

function resolveLocalUploadAbsolutePath(filePath) {
  if (typeof filePath !== "string" || !/^\/?uploads\//.test(filePath)) return null;

  const relPath = filePath.replace(/^\/+/, "");
  const uploadsRoot = path.resolve(resolveUploadsRoot());
  const uploadsRelativePath = relPath.replace(/^uploads\/+/i, "");
  const absolutePath = path.resolve(path.join(uploadsRoot, uploadsRelativePath));

  if (
    absolutePath !== uploadsRoot &&
    !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)
  ) {
    return null;
  }

  return absolutePath;
}

function getEvidenceLevel(totalImages, maxImages) {
  const count = Math.max(0, Number(totalImages) || 0);
  const max = Math.max(0, Number(maxImages) || 0);

  if (max && count > max) {
    return {
      level: "overflow",
      label: "Trop élevé",
      message: `Maximum ${max} preuves autorisées.`,
    };
  }

  if (count <= 3) {
    return {
      level: "low",
      label: "Faible",
      message: "Niveau faible — ajoutez plus de preuves.",
    };
  }
  if (count <= 5) {
    return {
      level: "acceptable",
      label: "Acceptable",
      message: "Niveau acceptable — ajoutez encore quelques preuves.",
    };
  }
  if (count <= 10) {
    return {
      level: "good",
      label: "Bon",
      message: "Niveau bon — ajoutez plus de preuves si possible.",
    };
  }
  return {
    level: "excellent",
    label: "Excellent",
    message: "Niveau excellent — preuves suffisantes.",
  };
}

/* ======================================================
   🌍 Scope helpers (source de vérité = resource liée)
====================================================== */
function canAccessGeoScope(user, resource) {
  return canAccessGeoResource(resource, user);
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

    // ✅ + scope geo strict
    return ok && canAccessGeoScope(user, task.service || task.property || task);
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
    const ok = String(order.userId) === uid || String(order.clientId) === uid;
    return ok && canAccessGeoScope(user, order);
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

    const newEvidenceCount = files.length;
    let existingEvidenceCount = 0;

    // Règle métier: max preuves uniquement pour les preuves de tâche
    if (taskId) {
      existingEvidenceCount = await Evidence.count({
        where: { taskId },
      });

      const totalEvidenceCount = existingEvidenceCount + newEvidenceCount;

      if (newEvidenceCount > 0 && totalEvidenceCount > EVIDENCE_MAX_IMAGES) {
        return res.status(400).json({
          error: `Maximum ${EVIDENCE_MAX_IMAGES} preuves autorisées pour cette tâche.`,
          details: {
            maxEvidences: EVIDENCE_MAX_IMAGES,
            currentEvidences: existingEvidenceCount,
            newEvidences: newEvidenceCount,
            totalEvidences: totalEvidenceCount,
          },
        });
      }
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

    const imageKitEnabled = isImageKitEnabled();
    const fallbackPolicy = resolveLocalFallbackPolicy();
    const allowLocalFallback = fallbackPolicy.allowLocalFallback;
    if (!imageKitEnabled) {
      if (!allowLocalFallback) {
        logger.error(
          buildMediaStorageDiagnostics({
            module: "evidence",
            taskId: taskId || null,
            orderId: orderId || null,
            fallbackPolicy,
            moduleFallbackEnvVar: EVIDENCE_LOCAL_FALLBACK_ENV_VAR,
          }),
          "evidence.media_storage.unconfigured.production"
        );
        throw mediaStorageError();
      }
      logger.warn(
        buildMediaStorageDiagnostics({
          module: "evidence",
          taskId: taskId || null,
          orderId: orderId || null,
          fallbackPolicy,
          moduleFallbackEnvVar: EVIDENCE_LOCAL_FALLBACK_ENV_VAR,
        }),
        "evidence.imagekit.disabled.fallback_local"
      );
    }

    const results = await mapWithConcurrency(
      files,
      EVIDENCE_UPLOAD_CONCURRENCY,
      async (f, idx) => {
        try {
          const fileName = buildEvidenceFileName(f.originalname, idx);
          let uploaded = null;

          if (imageKitEnabled) {
            try {
              uploaded = await uploadToImageKitWithRetry({
                file: f.buffer,
                fileName,
                folder: "/teranga/evidences/",
              });
            } catch (err) {
              logger.warn(
                buildMediaStorageDiagnostics({
                  module: "evidence",
                  fileName: f?.originalname || null,
                  code: err?.code || err?.cause?.code || null,
                  reason: err?.message || null,
                  allowLocalFallback,
                  fallbackPolicy,
                  moduleFallbackEnvVar: EVIDENCE_LOCAL_FALLBACK_ENV_VAR,
                }),
                "evidence.imagekit.upload.failed.fallback_local"
              );
              if (!allowLocalFallback) {
                throw mediaStorageError();
              }
            }
          }

          if (!uploaded || !uploaded.url) {
            if (imageKitEnabled) {
              logger.warn(
                buildMediaStorageDiagnostics({
                  module: "evidence",
                  fileName: f?.originalname || null,
                  allowLocalFallback,
                  fallbackPolicy,
                  moduleFallbackEnvVar: EVIDENCE_LOCAL_FALLBACK_ENV_VAR,
                }),
                "evidence.imagekit.upload_missing_url.fallback_local"
              );
            }
            if (!allowLocalFallback) {
              throw mediaStorageError();
            }
            uploaded = await saveEvidenceLocally(f, fileName);
          }

          const created = await Evidence.create({
            taskId: task ? task.id || task.taskId || taskId : null,
            orderId: order ? order.id || order.orderId || orderId : null,
            uploaderId: req.user.id,
            kind: guessKind(f.mimetype),
            mimeType: f.mimetype || null,
            originalName: f.originalname || null,
            filePath: uploaded.url,
            fileId: uploaded.fileId || null,
            fileSize: f.size || null,
            thumbnailPath: null,
            notes,

            // 🌍 multi-pays (héritage strict)
            countryId: geoCountryId,
            regionId: geoRegionId,
          });

          return { ok: true, id: created.id };
        } catch (err) {
          if (err?.code === EVIDENCE_MEDIA_STORAGE_ERROR_CODE) {
            throw err;
          }
          return {
            ok: false,
            originalName: f?.originalname || null,
            error: err?.message || "Upload failed",
          };
        }
      }
    );

    const createdIds = results
      .filter((r) => r && r.ok && r.id)
      .map((r) => r.id);

    const failed = results
      .filter((r) => r && !r.ok)
      .map((r) => ({ name: r.originalName, error: r.error }));

    const withIncludes = createdIds.length
      ? await Evidence.findAll({
          where: { id: { [Op.in]: createdIds } },
          include: [
            {
              model: User,
              as: "uploader",
              attributes: ["id", "firstName", "lastName", "email"],
            },
          ],
          order: [["createdAt", "DESC"]],
        })
      : [];

    const uploadedEvidenceCount = results.filter((r) => r && r.ok).length;
    const evidenceLevel = taskId
      ? getEvidenceLevel(existingEvidenceCount + uploadedEvidenceCount, EVIDENCE_MAX_IMAGES)
      : null;

    const response = {
      message: createdIds.length
        ? "Preuve(s) ajoutée(s) avec succès"
        : "Aucune preuve n'a pu être ajoutée",
      evidences: withIncludes.map(addLabels),
    };

    if (taskId) {
      response.evidenceStats = {
        existingEvidences: existingEvidenceCount,
        requestedEvidences: newEvidenceCount,
        uploadedEvidences: uploadedEvidenceCount,
        totalEvidences: existingEvidenceCount + uploadedEvidenceCount,
        level: evidenceLevel,
      };
    }

    if (failed.length > 0) {
      response.warnings = {
        failedFiles: failed,
      };
    }

    try {
      const adminIds = await getAdminRecipientIds({
        countryId: geoCountryId,
        regionId: geoRegionId,
      });

      const agentRecipient = task
        ? task.assignedTo ?? task?.service?.agentId ?? null
        : null;
      const clientRecipient = task
        ? task?.service?.clientId ?? task?.property?.ownerId ?? task?.creatorId ?? null
        : order
        ? order?.userId ?? order?.clientId ?? null
        : null;

      const recipients = [...adminIds, agentRecipient, clientRecipient];
      const evidenceCount = createdIds.length;

      if (evidenceCount > 0) {
        await emitEvent({
          recipients,
          actorId: req.user.id,
          entityType: "evidence",
          entityId: createdIds[0],
          action: "created",
          title:
            evidenceCount > 1
              ? "Nouvelles preuves"
              : "Nouvelle preuve",
          message:
            evidenceCount > 1
              ? `${evidenceCount} preuves ajoutées`
              : "Une preuve a été ajoutée",
          progress: computeProgress("evidence", null),
          entityStatus: null,
          metadata: {
            evidenceCount,
            taskId: task?.id || null,
            orderId: order?.id || null,
          },
          countryId: geoCountryId,
          regionId: geoRegionId,
          excludeRecipientId: req.user.id,
          notificationMode: "create",
        });
      }
    } catch (err) {
      logger.warn("Notification preuve (create) échouée:", err?.message || err);
    }

    return res.status(createdIds.length ? 201 : 500).json(response);
  } catch (e) {
    if (e?.code === EVIDENCE_MEDIA_STORAGE_ERROR_CODE) {
      return res.status(503).json({
        error:
          "Stockage des preuves indisponible en production. Configurez ImageKit ou un UPLOADS_ROOT persistant.",
      });
    }
    logger.error("Erreur create evidence:", e);
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
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

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
    const finalWhere = applyGeoScopeForModel
      ? applyGeoScopeForModel(where, req.user, Evidence, { includeClients: true })
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
    logger.error("Erreur list evidences:", e);
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

    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);

    let where = { taskId };
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    where = applyGeoScopeForModel
      ? applyGeoScopeForModel(where, req.user, Evidence, { includeClients: true })
      : where;

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
    logger.error("Erreur listByTask:", e);
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

    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);

    let where = { orderId };
    if (countryId) where.countryId = countryId;
    if (regionId) where.regionId = regionId;

    where = applyGeoScopeForModel
      ? applyGeoScopeForModel(where, req.user, Evidence, { includeClients: true })
      : where;

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
    logger.error("Erreur listByOrder:", e);
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
    } else if (req.user.role === "client" || req.user.role === "agent") {
      if (!ev.uploaderId || String(ev.uploaderId) !== String(req.user.id)) {
        return res.status(403).json({
          error: "Seul l'auteur de la preuve peut la supprimer.",
        });
      }

      if (ev.task && !canAccessTask(req.user, ev.task)) {
        return res.status(403).json({ error: "Accès interdit" });
      }
      if (ev.order && !canAccessOrder(req.user, ev.order)) {
        return res.status(403).json({ error: "Accès interdit" });
      }

      const createdAt = ev.createdAt ? new Date(ev.createdAt) : null;
      const createdAtMs = createdAt ? createdAt.getTime() : NaN;
      const ageMs = Number.isFinite(createdAtMs)
        ? Date.now() - createdAtMs
        : DELETE_WINDOW_MS + 1;

      if (ageMs > DELETE_WINDOW_MS) {
        const deleteUntil = Number.isFinite(createdAtMs)
          ? new Date(createdAtMs + DELETE_WINDOW_MS).toISOString()
          : null;
        return res.status(403).json({
          error: "Suppression possible uniquement dans l'heure suivant l'ajout.",
          details: { deleteUntil },
        });
      }
    } else {
      return res.status(403).json({
        error: "Suppression non autorisée pour ce rôle.",
      });
    }

    // 🗑️ Suppression ImageKit
    if (ev.fileId) {
      try {
        await imagekit.deleteFile(ev.fileId);
      } catch (e) {
        logger.warn(
          "⚠️ Impossible de supprimer le fichier ImageKit:",
          e.message
        );
      }
    }

    if (ev.filePath && /^\/?uploads\//.test(ev.filePath)) {
      const absolutePath = resolveLocalUploadAbsolutePath(ev.filePath);
      if (!absolutePath) {
        logger.warn(
          { filePath: ev.filePath },
          "evidence.local_file.delete.blocked_path"
        );
      } else {
      try {
        await fs.promises.unlink(absolutePath);
      } catch (e) {
        logger.warn("Impossible de supprimer le fichier local:", e.message);
      }
      }
    }

    await ev.destroy();

    return res.json({ message: "Preuve supprimée avec succès" });
  } catch (e) {
    logger.error("Erreur remove evidence:", e);
    return res.status(500).json({
      error: "Erreur lors de la suppression du fichier",
    });
  }
};
