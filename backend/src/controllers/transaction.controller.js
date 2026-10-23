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
  Order,
  Project,
} = require("../../models");

// 🧱 Service interne Teranga : ACL / WHERE / Pagination
const {
  toSafeInt,
  toTrimOrNull,
  getPagination,
  buildWhereWithACL,
  canAccessTransaction,
  COMMON_INCLUDE,
  isGlobalAdmin,
} = require("../services/transaction.service");

// 📸 ImageKit Helper unifié
const imageKit = require("../helpers/teranga-imagekit");
const logger = require('../utils/logger');
const { normalizeCurrency } = require('../utils/currency');
const { loadFinancialSummary } = require('../services/financialSummary.service');
const { resolveTransactionContext } = require('../services/transactionContext.service');
const { resolveUploadsRoot } = require("../utils/uploadsRoot");
const {
  buildMediaStorageDiagnostics,
  isImageKitConfigured,
} = require("../utils/mediaStorageDiagnostics");
const { evaluateLocalMediaFallback } = require("../utils/mediaStoragePolicy");

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
const TRANSACTION_MEDIA_STORAGE_ERROR_CODE =
  "TRANSACTION_MEDIA_STORAGE_UNAVAILABLE";
const TRANSACTION_LOCAL_FALLBACK_ENV_VAR =
  "TRANSACTION_ALLOW_LOCAL_FALLBACK";

/* ============================================================================
 *  🧩 ImageKit Enabled ?
 * ============================================================================ */
function isImageKitEnabled() {
  return isImageKitConfigured(process.env);
}

function resolveLocalFallbackPolicy() {
  return evaluateLocalMediaFallback({
    moduleFallbackEnvVar: TRANSACTION_LOCAL_FALLBACK_ENV_VAR,
  });
}

function mediaStorageError() {
  const err = new Error(
    "Stockage des preuves de transaction indisponible. Configurez IMAGEKIT_* ou UPLOADS_ROOT persistant."
  );
  err.code = TRANSACTION_MEDIA_STORAGE_ERROR_CODE;
  return err;
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

  const uploadsRoot = resolveUploadsRoot();
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

function hasPaymentProof(proofFile) {
  return Boolean(extractProofUrl(proofFile));
}

function isLocalUploadPath(filePath) {
  return typeof filePath === "string" && /^\/?uploads\//.test(filePath);
}

async function removeLocalUpload(filePath) {
  if (!isLocalUploadPath(filePath)) return;

  const relPath = filePath.replace(/^\/+/, "");
  const uploadsRoot = path.resolve(resolveUploadsRoot());
  const uploadsRelativePath = relPath.replace(/^uploads\/+/i, "");
  const absolutePath = path.resolve(path.join(uploadsRoot, uploadsRelativePath));

  if (
    absolutePath !== uploadsRoot &&
    !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)
  ) {
    logger.warn(
      { filePath },
      "transaction.proof.local_delete.blocked_path"
    );
    return;
  }

  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    logger.warn(
      { filePath, message: err?.message },
      "transaction.proof.local_delete.failed"
    );
  }
}

/* ============================================================================
 *  ⭐ ImageKit Upload sécurisé
 * ============================================================================ */
async function uploadProofToImageKit(file, fallbackPolicy) {
  const baseMeta = {
    originalName: file?.originalname || null,
    mimeType: file?.mimetype || null,
    size: file?.size ?? null,
  };
  const effectivePolicy = fallbackPolicy || resolveLocalFallbackPolicy();
  const allowLocalFallback = effectivePolicy.allowLocalFallback;
  const diagnosticsBase = {
    module: "transaction",
    fileName: file?.originalname || null,
    allowLocalFallback,
    fallbackPolicy: effectivePolicy,
    moduleFallbackEnvVar: TRANSACTION_LOCAL_FALLBACK_ENV_VAR,
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
        buildMediaStorageDiagnostics(diagnosticsBase),
        "transaction.imagekit.upload_missing_url.fallback_local"
      );
      if (!allowLocalFallback) {
        throw mediaStorageError();
      }
    } catch (e) {
      logger.warn(
        buildMediaStorageDiagnostics({
          ...diagnosticsBase,
          err: e,
        }),
        "transaction.imagekit.upload.failed.fallback_local"
      );
      if (!allowLocalFallback) {
        throw mediaStorageError();
      }
    }
  } else {
    if (!allowLocalFallback) {
      logger.error(
        buildMediaStorageDiagnostics(diagnosticsBase),
        "transaction.media_storage.unconfigured.production"
      );
      throw mediaStorageError();
    }
    logger.warn(
      buildMediaStorageDiagnostics(diagnosticsBase),
      "transaction.imagekit.disabled.fallback_local"
    );
  }

  if (!allowLocalFallback) {
    throw mediaStorageError();
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
    if (!allowLocalFallback) {
      throw mediaStorageError();
    }
    throw e;
  }
}

/* ============================================================================
 * 1️⃣ CREATE TRANSACTION
 * - admin global / admin scoped / client safe
 * - GEO auto + override admin (scope géré via ACL service)
 * ============================================================================
 */
exports.create = async (req, res) => {
  let uploadedProof = null;
  let persisted = false;
  try {
    const {
      type,
      amount,
      currency,
      paymentMethod,
      description,
      status,
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

    const context = await resolveTransactionContext(req);
    const { service, task, order, project } = context;
    const ownerUserId = order?.userId ?? req.user.id;
    const existing = order ? await Transaction.findOne({ where: { orderId: order.id, userId: ownerUserId, type: txType } }) : null;
    if (existing && normalizeCurrency(existing.currency) !== normalizeCurrency(currency, context.currency)) {
      return res.status(409).json({ error: 'Une transaction existe dans une autre devise pour cette commande. Modifiez explicitement cette transaction.' });
    }
    const fallbackPolicy = resolveLocalFallbackPolicy();
    const up = extractUploadFile(req);
    const proofFile = up && !existing?.proofFile ? await uploadProofToImageKit(up, fallbackPolicy) : null;
    uploadedProof = proofFile;

    const payload = {
      userId: ownerUserId,
      serviceId: service?.id || null,
      taskId: task?.id || null,
      orderId: order?.id || null,
      projectId: project?.id || null,

      type: txType,
      amount: parsedAmount,
      currency: normalizeCurrency(currency, context.currency),
      paymentMethod: toTrimOrNull(paymentMethod),
      description: toTrimOrNull(description),
      proofFile,

      status: "pending",

      // 🌍 GEO persisté
      countryId: context.countryId,
      regionId: context.regionId,
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

    // Le paiement reste externe : une clôture manuelle doit être accompagnée
    // d'un reçu ou d'une preuve uploadée. Les clôtures héritées d'une commande
    // conservent leur comportement historique pour éviter toute régression.
    if (status === "completed" && !hasPaymentProof(payload.proofFile || existing?.proofFile)) {
      if (uploadedProof) await discardProof(uploadedProof);
      uploadedProof = null;
      return res.status(400).json({
        error: "Une preuve de paiement (reçu) est obligatoire pour clôturer la transaction.",
        code: "PAYMENT_PROOF_REQUIRED",
      });
    }

    // 🔄 Prévention doublon (transaction unique par order + type)
    let created = null;

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
      persisted = true;

      created = await Transaction.findByPk(existing.id, {
        include: COMMON_INCLUDE.concat([
          { model: Order, as: "order" },
          { model: Project, as: "project" },
        ]),
      });
    } else {
      const trx = await Transaction.create(payload);
      persisted = true;

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
    if (uploadedProof && !persisted) await discardProof(uploadedProof);
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e?.code === TRANSACTION_MEDIA_STORAGE_ERROR_CODE) {
      return res.status(503).json({
        error:
          "Stockage des preuves de transaction indisponible en production. Configurez ImageKit ou un UPLOADS_ROOT persistant.",
      });
    }
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
      const search = [
        { description: { [Op.like]: needle } },
        { paymentMethod: { [Op.like]: needle } },
        { type: { [Op.like]: needle } },
        { status: { [Op.like]: needle } },
      ];
      where[Op.and] = [...(where[Op.and] || []), { [Op.or]: search }];
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
      order: [[sortKey, sortDir], ...(sortKey !== 'id' ? [['id', sortDir]] : [])],
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
async function discardProof(proof) {
  if (!proof) return;
  try {
    if (proof.fileId && isImageKitEnabled()) await imageKit.deleteFile(proof.fileId);
    const url = extractProofUrl(proof);
    if (url) await removeLocalUpload(url);
  } catch (err) {
    logger.warn({ err }, 'transaction.proof.cleanup.failed');
  }
}

exports.update = async (req, res) => {
  let uploadedProof = null;
  let persisted = false;
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });
    const trx = await Transaction.findByPk(id, { include: COMMON_INCLUDE });
    if (!trx) return res.status(404).json({ error: 'Transaction introuvable' });
    if (!await canAccessTransaction(req, trx)) return res.status(403).json({ error: 'Accès interdit' });

    const body = req.body || {};
    const updates = {};
    const isAdmin = req.user?.role === 'admin';
    const linkFields = ['serviceId', 'taskId', 'orderId', 'projectId'];
    const geoFields = ['countryId', 'regionId', 'country_id', 'region_id'];
    const scopeChanged = [...linkFields, ...geoFields].some((field) => body[field] !== undefined);
    const context = scopeChanged ? await resolveTransactionContext(req, { previous: trx }) : {
      service: trx.service, task: trx.task, order: trx.order, project: trx.project,
      countryId: trx.countryId, regionId: trx.regionId,
    };
    if (scopeChanged) {
      for (const field of linkFields) {
        if (body[field] !== undefined) updates[field] = context[field.replace(/Id$/, '')]?.id ?? null;
      }
      if (body.orderId !== undefined && context.order) updates.userId = context.order.userId;
      updates.countryId = context.countryId;
      updates.regionId = context.regionId;
    }
    if (body.description !== undefined) updates.description = toTrimOrNull(body.description);
    if (body.paymentMethod !== undefined) updates.paymentMethod = toTrimOrNull(body.paymentMethod);
    for (const field of ['status', 'currency', 'type', 'amount']) {
      if (body[field] !== undefined && !isAdmin) return res.status(403).json({ error: 'Seul un administrateur peut modifier ce champ financier' });
    }
    if (body.status !== undefined) {
      const status = String(body.status).trim();
      if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ error: 'Statut invalide' });
      updates.status = status;
    }
    if (body.currency !== undefined) updates.currency = normalizeCurrency(body.currency, trx.currency || 'XOF');
    if (body.type !== undefined) {
      const type = String(body.type).trim();
      if (!ALLOWED_TYPES.has(type)) return res.status(400).json({ error: 'Type invalide' });
      updates.type = type;
    }
    if (body.amount !== undefined) {
      const amount = parseAmount(body.amount);
      if (amount === null) return res.status(400).json({ error: 'Montant invalide' });
      updates.amount = amount;
    }
    const up = extractUploadFile(req);
    const previousProof = trx.proofFile;
    if (body.status === 'completed' && !hasPaymentProof(previousProof) && !up) {
      return res.status(400).json({ error: 'Une preuve de paiement est obligatoire pour clôturer la transaction.', code: 'PAYMENT_PROOF_REQUIRED' });
    }
    if (context.order && ['paid', 'delivered'].includes(context.order.status)) updates.status = 'completed';

    // La preuve précédente reste disponible jusqu'à la persistance du remplacement.
    if (up) {
      uploadedProof = await uploadProofToImageKit(up, resolveLocalFallbackPolicy());
      updates.proofFile = uploadedProof;
      if (body.status === 'completed' && !hasPaymentProof(uploadedProof)) {
        throw Object.assign(new Error('Une preuve de paiement valide est requise'), { status: 400 });
      }
    }
    Object.assign(trx, updates);
    await trx.save();
    persisted = true;
    const oldProof = normalizeProofMeta(previousProof);
    if (uploadedProof && oldProof && (oldProof.fileId !== uploadedProof.fileId || extractProofUrl(oldProof) !== extractProofUrl(uploadedProof))) await discardProof(oldProof);
    const updated = await Transaction.findByPk(trx.id, { include: COMMON_INCLUDE });
    return res.json({ message: 'Transaction mise à jour', transaction: withLabels(updated) });
  } catch (e) {
    if (uploadedProof && !persisted) await discardProof(uploadedProof);
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e?.code === TRANSACTION_MEDIA_STORAGE_ERROR_CODE) {
      return res.status(503).json({ error: 'Stockage des preuves de transaction indisponible en production. Configurez ImageKit ou un UPLOADS_ROOT persistant.' });
    }
    logger.error({ err: e }, 'transaction.update.failed');
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de la transaction' });
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

    if (!isGlobalAdmin(req.user)) {
      return res
        .status(403)
        .json({ error: "Action réservée à un administrateur global" });
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
    return res.json(await loadFinancialSummary(req));
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
    const { startDate, endDate } = req.query || {};

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 864e5);
    const end = endDate ? new Date(endDate) : new Date();
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
      return res.status(400).json({ error: 'Période de rapport invalide' });
    }
    const summary = await loadFinancialSummary(req, { createdAt: { [Op.between]: [start, end] } });
    const toTotals = (item) => ({ revenue: item.revenues, expense: item.expenses, commission: item.commissions, adjustment: item.adjustments });
    const byCurrency = summary.byCurrency.map((item) => ({ currency: item.currency, count: item.count, balance: item.balance, totals: toTotals(item) }));
    const totals = toTotals(summary);
    const totalsWithLabels = byCurrency.flatMap((item) => Object.entries(item.totals).map(([type, amount]) => ({ type, typeLabel: getLabel(type, TRANSACTION_TYPES), amount, currency: item.currency })));

    return res.json({
      period: { start, end },
      count: summary.count,
      currency: summary.currency,
      multiCurrency: summary.multiCurrency,
      byCurrency,
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

