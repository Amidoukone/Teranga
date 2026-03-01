/**
 * ============================================================================
 *  TERANGA DIASPORA — TRANSACTION CONTROLLER (Version 2025 PRO)
 *  Ultra-stable • ImageKit-safe • ACL unifié • Gestion multi-modules
 *  ✅ Intégration GEO: countryId / regionId (sans supprimer de fonctionnalités)
 * ============================================================================
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const {
  Transaction,
  User,
  Service,
  Task,
  Order,
  Project,
} = require("../../models");
const {
  applyGeoScopeForModel,
  getCountryIdByIso,
  getUserGeoScope,
} = require("../utils/geoScope");

// 🧱 Service interne Teranga : ACL / WHERE / Pagination
const {
  toSafeInt,
  toTrimOrNull,
  getPagination,
  buildWhereWithACL,
  canAccessTransaction,
  COMMON_INCLUDE,
} = require("../services/transaction.service");

// 📸 ImageKit Helper unifié
const imageKit = require("../helpers/teranga-imagekit");
const logger = require('../utils/logger');

// 📌 Labels français
const {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  CURRENCY_LABELS,
  getLabel,
} = require("../utils/labels");

// 📌 Sets de validation
const ALLOWED_TYPES = new Set(Object.keys(TRANSACTION_TYPES || {}));
const ALLOWED_STATUSES = new Set(Object.keys(TRANSACTION_STATUSES || {}));
const KNOWN_CURRENCIES = new Set(Object.keys(CURRENCY_LABELS || {}));

/* ============================================================================
 *  🧩 ImageKit Enabled ?
 * ============================================================================ */
function isImageKitEnabled() {
  return Boolean(
    process.env.IMAGEKIT_PUBLIC_KEY &&
      process.env.IMAGEKIT_PRIVATE_KEY &&
      process.env.IMAGEKIT_URL_ENDPOINT
  );
}

/* ============================================================================
 *  🧩 Helpers divers
 * ============================================================================ */
function withLabels(trx) {
  if (!trx) return null;
  const t = trx.toJSON ? trx.toJSON() : trx;
  return {
    ...t,
    typeLabel: getLabel(t.type, TRANSACTION_TYPES),
    statusLabel: getLabel(t.status, TRANSACTION_STATUSES),
    currencyLabel: getLabel(t.currency, CURRENCY_LABELS),
  };
}

function parseAmount(val) {
  if (val === null || val === undefined || val === "") return null;
  const normalized = String(val).trim().replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function normalizeCurrency(input, fallback = "XOF") {
  if (!input) return fallback;
  const cur = String(input).toUpperCase().trim();
  return KNOWN_CURRENCIES.has(cur) ? cur : fallback;
}

function parseBooleanQuery(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

/**
 * Extraction robuste du fichier uploadé (multer)
 */
function extractUploadFile(req) {
  if (req.file) return req.file;
  if (Array.isArray(req.files) && req.files.length) return req.files[0];

  if (req.files && typeof req.files === "object") {
    const candidates = ["proofFile", "file", "attachment", "files", "proof"];
    for (const key of candidates) {
      const arr = req.files[key];
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    }
  }
  return null;
}

function sanitizeBasename(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildLocalTransactionProofName(originalName = "file") {
  const base = path.basename(originalName || "file");
  const ext = path.extname(base || "").toLowerCase();
  const stem = base.slice(0, base.length - ext.length);
  const safeStem = sanitizeBasename(stem) || "file";
  const safeExt = ext && ext.length <= 10 ? ext : "";
  const salt = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now();
  return `transaction_${timestamp}_${salt}_${safeStem}${safeExt}`;
}

async function saveTransactionProofLocally(file) {
  if (!file?.buffer) {
    throw new Error("Fichier invalide: buffer absent");
  }

  const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
  const transactionsDir = path.join(uploadsRoot, "transactions");
  await fs.promises.mkdir(transactionsDir, { recursive: true });

  const localName = buildLocalTransactionProofName(file.originalname);
  const absolutePath = path.join(transactionsDir, localName);

  await fs.promises.writeFile(absolutePath, file.buffer);

  return {
    url: `/uploads/transactions/${localName}`,
    fileId: null,
  };
}

function normalizeProofMeta(rawProof) {
  if (!rawProof) return null;
  if (typeof rawProof === "object") return rawProof;
  if (typeof rawProof !== "string") return null;

  const trimmed = rawProof.trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_err) {
      // legacy non-JSON string
    }
  }

  return { url: trimmed };
}

function extractProofUrl(rawProof) {
  const pf = normalizeProofMeta(rawProof);
  if (!pf) return "";

  const direct =
    pf.url ||
    pf.path ||
    pf.filePath ||
    pf.file_url ||
    pf.location ||
    (typeof pf.file === "string" ? pf.file : "");

  if (direct) return String(direct);

  const nested = pf.file && typeof pf.file === "object" ? pf.file : null;
  if (!nested) return "";
  return String(nested.url || nested.path || nested.filePath || "");
}

function isLocalUploadPath(filePath) {
  return typeof filePath === "string" && /^\/?uploads\//.test(filePath);
}

async function removeLocalUpload(filePath) {
  if (!isLocalUploadPath(filePath)) return;

  const relPath = filePath.replace(/^\/+/, "");
  const absolutePath = path.join(__dirname, "..", "..", relPath);

  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    logger.warn(
      { filePath, message: err?.message },
      "transaction.proof.local_delete.failed"
    );
  }
}

/**
 * GEO helper : déduire countryId / regionId depuis modules liés
 * - Non destructif
 * - Compatible legacy
 */
async function resolveGeoFromLinks({ serviceId, taskId, orderId, projectId }) {
  const sid = toSafeInt(serviceId);
  const tid = toSafeInt(taskId);
  const oid = toSafeInt(orderId);
  const pid = toSafeInt(projectId);

  const [service, task, order, project] = await Promise.all([
    sid
      ? Service.findByPk(sid, { attributes: ["id", "countryId", "regionId"] })
      : null,
    tid
      ? Task.findByPk(tid, { attributes: ["id", "countryId", "regionId"] })
      : null,
    oid
      ? Order.findByPk(oid, {
          attributes: ["id", "countryId", "regionId", "userId", "status"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "countryId", "regionId", "country"],
            },
          ],
        })
      : null,
    pid
      ? Project.findByPk(pid, {
          attributes: ["id", "countryId", "regionId"],
          include: [
            {
              model: User,
              as: "client",
              attributes: ["id", "country"],
            },
          ],
        })
      : null,
  ]);

  const legacyProjectCountryId =
    project?.countryId == null && project?.client?.country
      ? await getCountryIdByIso(project.client.country)
      : null;

  const legacyOrderUserCountryId =
    order?.countryId == null && order?.user?.country
      ? await getCountryIdByIso(order.user.country)
      : null;

  return {
    countryId:
      service?.countryId ??
      task?.countryId ??
      project?.countryId ??
      legacyProjectCountryId ??
      order?.countryId ??
      order?.user?.countryId ??
      legacyOrderUserCountryId ??
      null,

    regionId:
      service?.regionId ??
      task?.regionId ??
      project?.regionId ??
      order?.regionId ??
      order?.user?.regionId ??
      null,
  };
}

/* ============================================================================
 *  ⭐ ImageKit Upload sécurisé
 * ============================================================================ */
async function uploadProofToImageKit(file) {
  const baseMeta = {
    originalName: file?.originalname || null,
    mimeType: file?.mimetype || null,
    size: file?.size ?? null,
  };

  if (isImageKitEnabled()) {
    try {
      const uploaded = await imageKit.upload({
        file: file.buffer,
        fileName: `transaction_${Date.now()}_${file.originalname}`,
        folder: "/teranga/transactions/",
      });

      const uploadedUrl =
        uploaded?.url || uploaded?.fileUrl || uploaded?.path || "";

      if (uploadedUrl) {
        return {
          ...baseMeta,
          url: uploadedUrl,
          fileId: uploaded?.fileId || null,
        };
      }

      logger.warn(
        { fileName: file?.originalname },
        "transaction.imagekit.upload_missing_url.fallback_local"
      );
    } catch (e) {
      logger.warn(
        { err: e, fileName: file?.originalname },
        "transaction.imagekit.upload.failed.fallback_local"
      );
    }
  } else {
    logger.warn("transaction.imagekit.disabled.fallback_local");
  }

  try {
    const localSaved = await saveTransactionProofLocally(file);
    return {
      ...baseMeta,
      url: localSaved.url,
      fileId: localSaved.fileId,
    };
  } catch (e) {
    logger.error({ err: e, fileName: file?.originalname }, "transaction.local_upload.failed");
    return {
      ...baseMeta,
      url: null,
      fileId: null,
    };
  }
}

/* ============================================================================
 * 1️⃣ CREATE TRANSACTION
 * - admin global / admin scoped / client safe
 * - GEO auto + override admin (scope géré via ACL service)
 * ============================================================================
 */
exports.create = async (req, res) => {
  try {
    const {
      serviceId,
      taskId,
      orderId,
      projectId,
      type,
      amount,
      currency,
      paymentMethod,
      description,
      status,

      // 🌍 GEO (admin only)
      countryId,
      regionId,
      country_id,
      region_id,
    } = req.body || {};

    if (!type) {
      return res.status(400).json({ error: "Type de transaction requis" });
    }

    const txType = String(type).trim();
    if (!ALLOWED_TYPES.has(txType)) {
      return res.status(400).json({ error: "Type de transaction invalide" });
    }

    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      return res.status(400).json({ error: "Montant invalide" });
    }

    const sid = toSafeInt(serviceId);
    const tid = toSafeInt(taskId);
    const oid = toSafeInt(orderId);
    const pid = toSafeInt(projectId);

    // Chargement des liens (non bloquant si absent)
    const [service, task, order, project] = await Promise.all([
      sid ? Service.findByPk(sid) : null,
      tid ? Task.findByPk(tid) : null,
      oid ? Order.findByPk(oid) : null,
      pid ? Project.findByPk(pid) : null,
    ]);

    /* -------------------------------
       📎 Upload preuve via ImageKit
       ------------------------------- */
    const up = extractUploadFile(req);
    const proofFile = up ? await uploadProofToImageKit(up) : null;

    // Owner userId : si transaction liée à une commande -> userId commande
    const ownerUserId = order?.userId ?? req.user.id;

    // 🌍 GEO (priorité = liens -> override admin -> null)
    const inferredGeo = await resolveGeoFromLinks({
      serviceId: sid,
      taskId: tid,
      orderId: oid,
      projectId: pid,
    });

    const isAdminLike = req.user?.role === "admin";
    const userScope = getUserGeoScope
      ? getUserGeoScope(req.user)
      : { countryId: null, regionId: null };
    const bodyCountryId = toSafeInt(countryId ?? country_id);
    const bodyRegionId = toSafeInt(regionId ?? region_id);

    const finalCountryId = isAdminLike
      ? (inferredGeo.countryId ?? bodyCountryId ?? null)
      : (inferredGeo.countryId ?? userScope.countryId ?? null);

    const finalRegionId = isAdminLike
      ? (inferredGeo.regionId ?? bodyRegionId ?? null)
      : (inferredGeo.regionId ?? userScope.regionId ?? null);

    const payload = {
      userId: ownerUserId,
      serviceId: service?.id || sid || null,
      taskId: task?.id || tid || null,
      orderId: order?.id || oid || null,
      projectId: project?.id || pid || null,

      type: txType,
      amount: parsedAmount,
      currency: normalizeCurrency(currency, "XOF"),
      paymentMethod: toTrimOrNull(paymentMethod),
      description: toTrimOrNull(description),
      proofFile,

      status: "pending",

      // 🌍 GEO persisté
      countryId: finalCountryId,
      regionId: finalRegionId,
    };

    // 🔄 Auto validation selon statut Order
    if (order && ["paid", "delivered"].includes(order.status)) {
      payload.status = "completed";
    } else if (project || !order) {
      payload.status = "completed";
    }

    // Admin seul peut forcer le status arbitrairement
    if (status && req.user?.role === "admin") {
      const s = String(status).trim();
      if (ALLOWED_STATUSES.has(s)) payload.status = s;
    }

    // 🔄 Prévention doublon (transaction unique par order + type)
    let created = null;

    const existing = order
      ? await Transaction.findOne({
          where: { orderId: order.id, userId: ownerUserId, type: txType },
        })
      : null;

    if (existing) {
      existing.amount = parsedAmount;

      // ✅ Compléter GEO si manquante (non destructif)
      if (existing.countryId == null && payload.countryId != null) {
        existing.countryId = payload.countryId;
      }
      if (existing.regionId == null && payload.regionId != null) {
        existing.regionId = payload.regionId;
      }

      // ✅ Compléter preuve si on a upload
      if (proofFile && !existing.proofFile) {
        existing.proofFile = proofFile;
      }

      if (existing.status !== "completed" && payload.status === "completed") {
        existing.status = "completed";
      }

      await existing.save();

      created = await Transaction.findByPk(existing.id, {
        include: COMMON_INCLUDE.concat([
          { model: Order, as: "order" },
          { model: Project, as: "project" },
        ]),
      });
    } else {
      const trx = await Transaction.create(payload);

      created = await Transaction.findByPk(trx.id, {
        include: COMMON_INCLUDE.concat([
          { model: Order, as: "order" },
          { model: Project, as: "project" },
        ]),
      });
    }

    return res.status(201).json({
      message: "Transaction enregistrée",
      transaction: withLabels(created),
    });
  } catch (e) {
    logger.error({ err: e }, "transaction.create.failed");
    return res.status(500).json({
      error: "Erreur lors de l'ajout de la transaction",
    });
  }
};

/* ============================================================================
 * 2️⃣ LIST TRANSACTIONS
 * ============================================================================ */
exports.list = async (req, res) => {
  try {
    // Evite les 304 (ETag) qui masquent les changements pendant le debug
    res.set('Cache-Control', 'no-store');

    const where = buildWhereWithACL(req);

    const {
      q,
      type,
      status,
      currency,
      paymentMethod,
      orderId,
      serviceId,
      taskId,
      projectId,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sort,
    } = req.query || {};

    // Filtres simples
    if (type) where.type = String(type).trim();
    if (status) where.status = String(status).trim();
    if (currency) where.currency = String(currency).toUpperCase().trim();
    if (paymentMethod)
      where.paymentMethod = { [Op.like]: `%${String(paymentMethod)}%` };

    const oid = toSafeInt(orderId);
    const sid = toSafeInt(serviceId);
    const tid = toSafeInt(taskId);
    const pid = toSafeInt(projectId);

    if (oid) where.orderId = oid;
    if (sid) where.serviceId = sid;
    if (tid) where.taskId = tid;
    if (pid) where.projectId = pid;

    // Montants
    const minA = parseAmount(minAmount);
    const maxA = parseAmount(maxAmount);
    if (minA !== null || maxA !== null) {
      where.amount = {};
      if (minA !== null) where.amount[Op.gte] = minA;
      if (maxA !== null) where.amount[Op.lte] = maxA;
    }

    // Dates
    if (startDate || endDate) {
      const start = startDate
        ? new Date(startDate)
        : new Date("1970-01-01T00:00:00Z");
      const end = endDate ? new Date(endDate) : new Date();
      where.createdAt = { [Op.between]: [start, end] };
    }

    // Recherche fulltext (light)
    if (q && String(q).trim()) {
      const needle = `%${String(q).trim()}%`;
      where[Op.or] = [
        { description: { [Op.like]: needle } },
        { paymentMethod: { [Op.like]: needle } },
        { type: { [Op.like]: needle } },
        { status: { [Op.like]: needle } },
      ];
    }

    const { limit, offset, page } = getPagination(req);
    const includeCount = parseBooleanQuery(
      req.query?.includeCount ?? req.query?.withCount,
      true
    );

    const sortKey = sort ? String(sort).replace(/^-/, "") : "createdAt";
    const sortDir = sort && String(sort).startsWith("-") ? "DESC" : "ASC";
    const include = COMMON_INCLUDE.concat([
      { model: Order, as: "order" },
      { model: Project, as: "project" },
    ]);
    const baseQuery = {
      where,
      include,
      order: [[sortKey, sortDir]],
      limit,
      offset,
      distinct: true,
    };

    let rows = [];
    let count = null;

    if (includeCount) {
      const result = await Transaction.findAndCountAll(baseQuery);
      rows = result.rows;
      count = result.count;
    } else {
      rows = await Transaction.findAll(baseQuery);
    }

    return res.json({
      transactions: rows.map(withLabels),
      pagination: {
        page,
        limit,
        offset,
        total: includeCount ? count : null,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "transaction.list.failed");
    return res.status(500).json({
      error: "Erreur lors de la récupération des transactions",
    });
  }
};

/* ============================================================================
 * 3️⃣ DETAIL
 * ============================================================================ */
exports.detail = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const trx = await Transaction.findByPk(id, {
      include: COMMON_INCLUDE.concat([
        { model: Order, as: "order" },
        { model: Project, as: "project" },
      ]),
    });

    if (!trx)
      return res.status(404).json({ error: "Transaction introuvable" });

    const allowed = await canAccessTransaction(req, trx);
    if (!allowed) return res.status(403).json({ error: "Accès interdit" });

    return res.json({ transaction: withLabels(trx) });
  } catch (e) {
    logger.error({ err: e }, "transaction.detail.failed");
    return res.status(500).json({
      error: "Erreur lors de la récupération de la transaction",
    });
  }
};

/* ============================================================================
 * 4️⃣ UPDATE (preuve + champs + ACL)
 * ✅ GEO: countryId / regionId (admin only)
 * - Recalcule GEO quand les liens changent, sans casser l'existant
 * ============================================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const trx = await Transaction.findByPk(id, {
      include: COMMON_INCLUDE.concat([
        { model: Order, as: "order" },
        { model: Project, as: "project" },
      ]),
    });

    if (!trx)
      return res.status(404).json({ error: "Transaction introuvable" });

    const allowed = await canAccessTransaction(req, trx);
    if (!allowed) return res.status(403).json({ error: "Accès interdit" });

    const {
      description,
      paymentMethod,
      status,
      currency,
      orderId,
      projectId,
      serviceId,
      taskId,
      type,
      amount,

      // ✅ GEO (admin only) camelCase + snake_case
      countryId,
      regionId,
      country_id,
      region_id,
    } = req.body || {};

    if (description !== undefined) trx.description = toTrimOrNull(description);
    if (paymentMethod !== undefined)
      trx.paymentMethod = toTrimOrNull(paymentMethod);

    /* ---------------------------------------
       📸 Nouvelle preuve : suppr + re-upload
       --------------------------------------- */
    const up = extractUploadFile(req);
    if (up) {
      const previousProof = trx.proofFile;

      if (trx.proofFile?.fileId) {
        try {
          await imageKit.deleteFile(trx.proofFile.fileId);
        } catch (err) {
          logger.warn({ err }, "transaction.proof.delete_old.failed");
        }
      }

      const previousProofUrl = extractProofUrl(previousProof);
      if (previousProofUrl) {
        await removeLocalUpload(previousProofUrl);
      }

      trx.proofFile = await uploadProofToImageKit(up);
    }

    const isAdmin = req.user?.role === "admin";
    const isAdminLike = req.user?.role === "admin";

    // Track si liens changent => recalcul GEO non destructif
    let linkChanged = false;

    if (serviceId !== undefined) {
      trx.serviceId = toSafeInt(serviceId) || null;
      linkChanged = true;
    }

    if (taskId !== undefined) {
      trx.taskId = toSafeInt(taskId) || null;
      linkChanged = true;
    }

    if (orderId !== undefined) {
      const newOid = toSafeInt(orderId);
      if (newOid) {
        const newOrder = await Order.findByPk(newOid);
        if (!newOrder)
          return res.status(400).json({ error: "Commande cible introuvable" });

        trx.orderId = newOrder.id;
        trx.userId = newOrder.userId;
      } else {
        trx.orderId = null;
      }
      linkChanged = true;
    }

    if (projectId !== undefined) {
      const newPid = toSafeInt(projectId);
      if (newPid) {
        const newProject = await Project.findByPk(newPid);
        if (!newProject)
          return res.status(400).json({ error: "Projet cible introuvable" });

        trx.projectId = newProject.id;
      } else {
        trx.projectId = null;
      }
      linkChanged = true;
    }

    // Champs sensibles: admin only (mais status strict admin si tu veux)
    if (status !== undefined) {
      const s = String(status).trim();
      if (!ALLOWED_STATUSES.has(s))
        return res.status(400).json({ error: "Statut invalide" });

      // ✅ On garde la règle forte: seul admin peut changer le status
      if (!isAdmin) {
        return res.status(403).json({
          error: "Seul un administrateur peut modifier le statut",
        });
      }

      trx.status = s;
    }

    if (currency !== undefined) {
      if (!isAdminLike)
        return res.status(403).json({
          error: "Seul un admin peut modifier la devise",
        });
      trx.currency = normalizeCurrency(currency, trx.currency || "XOF");
    }

    if (type !== undefined) {
      if (!isAdminLike)
        return res.status(403).json({
          error: "Seul un admin peut modifier le type",
        });

      const t = String(type).trim();
      if (!ALLOWED_TYPES.has(t))
        return res.status(400).json({ error: "Type invalide" });
      trx.type = t;
    }

    if (amount !== undefined) {
      if (!isAdminLike)
        return res.status(403).json({
          error: "Seul un admin peut modifier le montant",
        });

      const n = parseAmount(amount);
      if (n === null)
        return res.status(400).json({ error: "Montant invalide" });
      trx.amount = n;
    }

    // ✅ GEO (admin only)
    const geoCountrySent = countryId !== undefined || country_id !== undefined;
    const geoRegionSent = regionId !== undefined || region_id !== undefined;

    if (isAdminLike) {
      if (geoCountrySent) trx.countryId = toSafeInt(countryId ?? country_id);
      if (geoRegionSent) trx.regionId = toSafeInt(regionId ?? region_id);
    }

    // ✅ Recalc GEO si liens changent OU si geo manquante
    if (linkChanged || trx.countryId == null || trx.regionId == null) {
      const inferredGeo = await resolveGeoFromLinks({
        serviceId: trx.serviceId,
        taskId: trx.taskId,
        orderId: trx.orderId,
        projectId: trx.projectId,
      });

      // Non-destructif: complète seulement si null,
      // sauf si admin a explicitement envoyé une valeur (déjà posée au-dessus).
      if (trx.countryId == null && !geoCountrySent && inferredGeo.countryId != null) {
        trx.countryId = inferredGeo.countryId;
      }
      if (trx.regionId == null && !geoRegionSent && inferredGeo.regionId != null) {
        trx.regionId = inferredGeo.regionId;
      }
    }

    // Finalisation auto si Order payé (nécessite parfois re-fetch)
    if (trx.order && ["paid", "delivered"].includes(trx.order.status)) {
      trx.status = "completed";
    } else if (trx.orderId && !trx.order) {
      // Si include n'a pas refresh après changement de orderId
      const ord = await Order.findByPk(trx.orderId, { attributes: ["id", "status"] });
      if (ord && ["paid", "delivered"].includes(ord.status)) {
        trx.status = "completed";
      }
    }

    await trx.save();

    const updated = await Transaction.findByPk(trx.id, {
      include: COMMON_INCLUDE.concat([
        { model: Order, as: "order" },
        { model: Project, as: "project" },
      ]),
    });

    return res.json({
      message: "Transaction mise à jour",
      transaction: withLabels(updated),
    });
  } catch (e) {
    logger.error({ err: e }, "transaction.update.failed");
    return res.status(500).json({
      error: "Erreur lors de la mise à jour de la transaction",
    });
  }
};

/* ============================================================================
 * 5️⃣ DELETE — ImageKit removal + ACL
 * ============================================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID invalide" });

    const trx = await Transaction.findByPk(id);
    if (!trx)
      return res.status(404).json({ error: "Transaction introuvable" });

    const isOwner = req.user && String(trx.userId) === String(req.user.id);
    const isAdmin = req.user?.role === "admin";

    // Règle stable: admin peut tout supprimer, owner seulement si pending
    if (!(isAdmin || (isOwner && trx.status === "pending"))) {
      return res.status(403).json({ error: "Suppression non autorisée" });
    }

    if (trx.proofFile?.fileId && isImageKitEnabled()) {
      try {
        await imageKit.deleteFile(trx.proofFile.fileId);
      } catch (err) {
        logger.warn({ err }, "transaction.proof.delete.failed");
      }
    }

    const localProofUrl = extractProofUrl(trx.proofFile);
    if (localProofUrl) {
      await removeLocalUpload(localProofUrl);
    }

    await trx.destroy();

    return res.json({ message: "Transaction supprimée" });
  } catch (e) {
    logger.error({ err: e }, "transaction.remove.failed");
    return res.status(500).json({
      error: "Erreur lors de la suppression de la transaction",
    });
  }
};

/* ============================================================================
 * 6️⃣ SUMMARY
 * ============================================================================ */
exports.summary = async (req, res) => {
  try {
    const where = applyGeoScopeForModel({}, req.user, Transaction);
    const qCountryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const qRegionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);
    if (qCountryId) where.countryId = qCountryId;
    if (qRegionId) where.regionId = qRegionId;
    const [revenues, expenses, commissions, adjustments] = await Promise.all([
      Transaction.sum("amount", { where: { ...where, type: "revenue" } }),
      Transaction.sum("amount", { where: { ...where, type: "expense" } }),
      Transaction.sum("amount", { where: { ...where, type: "commission" } }),
      Transaction.sum("amount", { where: { ...where, type: "adjustment" } }),
    ]);

    const balance =
      (revenues || 0) -
      (expenses || 0) -
      (commissions || 0) +
      (adjustments || 0);

    return res.json({
      revenues,
      expenses,
      commissions,
      adjustments,
      balance,
    });
  } catch (e) {
    logger.error({ err: e }, "transaction.summary.failed");
    return res.status(500).json({
      error: "Erreur lors du calcul du résumé financier",
    });
  }
};

/* ============================================================================
 * 7️⃣ REPORT
 * ============================================================================ */
exports.report = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 864e5);
    const end = endDate ? new Date(endDate) : new Date();

    const where = applyGeoScopeForModel(
      { createdAt: { [Op.between]: [start, end] } },
      req.user,
      Transaction
    );
    const qCountryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const qRegionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);
    if (qCountryId) where.countryId = qCountryId;
    if (qRegionId) where.regionId = qRegionId;

    const transactions = await Transaction.findAll({
      where,
      include: [
        { model: User, as: "user", attributes: ["id", "email", "role"] },
        { model: Order, as: "order", attributes: ["id", "code", "status"] },
        { model: Project, as: "project", attributes: ["id", "title", "status"] },
      ],
      order: [["createdAt", "ASC"]],
    });

    const totals = {
      revenue: 0,
      expense: 0,
      commission: 0,
      adjustment: 0,
    };

    transactions.forEach((t) => {
      const k = t.type;
      totals[k] = (totals[k] || 0) + parseFloat(t.amount || 0);
    });

    const totalsWithLabels = Object.entries(totals).map(([key, value]) => ({
      type: key,
      typeLabel: getLabel(key, TRANSACTION_TYPES),
      amount: value,
    }));

    return res.json({
      period: { start, end },
      count: transactions.length,
      totals,
      totalsWithLabels,
    });
  } catch (e) {
    logger.error({ err: e }, "transaction.report.failed");
    return res.status(500).json({
      error: "Erreur lors de la génération du rapport",
    });
  }
};

/* ============================================================================
 * 8️⃣ LIST BY ORDER
 * ============================================================================ */
exports.listByOrder = async (req, res) => {
  try {
    const orderId = toSafeInt(req.params.id);
    if (!orderId) return res.status(400).json({ error: "orderId invalide" });

    const where = buildWhereWithACL(req);
    where.orderId = orderId;

    const { limit, offset, page } = getPagination(req);

    const { rows, count } = await Transaction.findAndCountAll({
      where,
      include: COMMON_INCLUDE.concat([{ model: Order, as: "order" }]),
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      transactions: rows.map(withLabels),
      pagination: { page, limit, offset, total: count },
    });
  } catch (e) {
    logger.error({ err: e }, "transaction.list_by_order.failed");
    return res.status(500).json({
      error: "Erreur lors de la récupération des transactions de cette commande",
    });
  }
};

