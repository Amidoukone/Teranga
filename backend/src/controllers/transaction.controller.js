/**
 * ============================================================================
 *  TERANGA DIASPORA — TRANSACTION CONTROLLER (Version 2025 PRO)
 *  Ultra-stable • ImageKit-safe • ACL unifié • Gestion multi-modules
 *  ✅ Intégration GEO: countryId / regionId (sans supprimer de fonctionnalités)
 * ============================================================================
 */

"use strict";

const { Op } = require("sequelize");
const {
  Transaction,
  User,
  Service,
  Task,
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
} = require("../services/transaction.service");

// 📸 ImageKit Helper unifié
const imageKit = require("../helpers/teranga-imagekit");

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
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function normalizeCurrency(input, fallback = "XOF") {
  if (!input) return fallback;
  const cur = String(input).toUpperCase().trim();
  return KNOWN_CURRENCIES.has(cur) ? cur : fallback;
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
        })
      : null,
    pid
      ? Project.findByPk(pid, { attributes: ["id", "countryId", "regionId"] })
      : null,
  ]);

  return {
    countryId:
      service?.countryId ??
      task?.countryId ??
      project?.countryId ??
      order?.countryId ??
      null,

    regionId:
      service?.regionId ??
      task?.regionId ??
      project?.regionId ??
      order?.regionId ??
      null,
  };
}

/* ============================================================================
 *  ⭐ ImageKit Upload sécurisé
 * ============================================================================ */
async function uploadProofToImageKit(file) {
  if (!isImageKitEnabled()) {
    console.warn("⚠️ ImageKit désactivé — upload ignoré");
    return {
      url: null,
      fileId: null,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  try {
    const uploaded = await imageKit.upload({
      file: file.buffer,
      fileName: `transaction_${Date.now()}_${file.originalname}`,
      folder: "/teranga/transactions/",
    });

    return {
      url: uploaded.url,
      fileId: uploaded.fileId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  } catch (e) {
    console.error("❌ Upload ImageKit échoué:", e);
    return {
      url: null,
      fileId: null,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}

/* ============================================================================
 * 1️⃣ CREATE TRANSACTION
 * - admin global / master scoped / client safe
 * - GEO auto + override admin/master (scope géré via ACL service)
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

      // 🌍 GEO (admin/master only)
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

    // 🌍 GEO (priorité = liens -> override admin/master -> null)
    const inferredGeo = await resolveGeoFromLinks({
      serviceId: sid,
      taskId: tid,
      orderId: oid,
      projectId: pid,
    });

    const isAdminLike = req.user?.role === "admin";
    const bodyCountryId = toSafeInt(countryId ?? country_id);
    const bodyRegionId = toSafeInt(regionId ?? region_id);

    const finalCountryId = isAdminLike
      ? (inferredGeo.countryId ?? bodyCountryId ?? null)
      : (inferredGeo.countryId ?? null);

    const finalRegionId = isAdminLike
      ? (inferredGeo.regionId ?? bodyRegionId ?? null)
      : (inferredGeo.regionId ?? null);

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
    console.error("❌ Erreur création transaction:", e);
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

    const sortKey = sort ? String(sort).replace(/^-/, "") : "createdAt";
    const sortDir = sort && String(sort).startsWith("-") ? "DESC" : "ASC";

    const { rows, count } = await Transaction.findAndCountAll({
      where,
      include: COMMON_INCLUDE.concat([
        { model: Order, as: "order" },
        { model: Project, as: "project" },
      ]),
      order: [[sortKey, sortDir]],
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      transactions: rows.map(withLabels),
      pagination: { page, limit, total: count },
    });
  } catch (e) {
    console.error("❌ Erreur list transactions:", e);
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
    console.error("❌ Erreur detail transaction:", e);
    return res.status(500).json({
      error: "Erreur lors de la récupération de la transaction",
    });
  }
};

/* ============================================================================
 * 4️⃣ UPDATE (preuve + champs + ACL)
 * ✅ GEO: countryId / regionId (admin/master only)
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

      // ✅ GEO (admin/master only) camelCase + snake_case
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
      if (trx.proofFile?.fileId) {
        try {
          await imageKit.deleteFile(trx.proofFile.fileId);
        } catch (err) {
          console.warn("⚠️ Impossible de supprimer ancienne preuve:", err.message);
        }
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

    // Champs sensibles: admin/master only (mais status strict admin si tu veux)
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
          error: "Seul un admin/master peut modifier la devise",
        });
      trx.currency = normalizeCurrency(currency, trx.currency || "XOF");
    }

    if (type !== undefined) {
      if (!isAdminLike)
        return res.status(403).json({
          error: "Seul un admin/master peut modifier le type",
        });

      const t = String(type).trim();
      if (!ALLOWED_TYPES.has(t))
        return res.status(400).json({ error: "Type invalide" });
      trx.type = t;
    }

    if (amount !== undefined) {
      if (!isAdminLike)
        return res.status(403).json({
          error: "Seul un admin/master peut modifier le montant",
        });

      const n = parseAmount(amount);
      if (n === null)
        return res.status(400).json({ error: "Montant invalide" });
      trx.amount = n;
    }

    // ✅ GEO (admin/master only)
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
      // sauf si admin/master a explicitement envoyé une valeur (déjà posée au-dessus).
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
    console.error("❌ Erreur update transaction:", e);
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
        console.warn(
          "⚠️ Impossible de supprimer la preuve ImageKit:",
          err.message
        );
      }
    }

    await trx.destroy();

    return res.json({ message: "Transaction supprimée" });
  } catch (e) {
    console.error("❌ Erreur suppression transaction:", e);
    return res.status(500).json({
      error: "Erreur lors de la suppression de la transaction",
    });
  }
};

/* ============================================================================
 * 6️⃣ SUMMARY
 * ============================================================================ */
exports.summary = async (_req, res) => {
  try {
    const [revenues, expenses, commissions, adjustments] = await Promise.all([
      Transaction.sum("amount", { where: { type: "revenue" } }),
      Transaction.sum("amount", { where: { type: "expense" } }),
      Transaction.sum("amount", { where: { type: "commission" } }),
      Transaction.sum("amount", { where: { type: "adjustment" } }),
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
    console.error("❌ Erreur summary:", e);
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

    const where = { createdAt: { [Op.between]: [start, end] } };

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
    console.error("❌ Erreur report:", e);
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
      pagination: { page, limit, total: count },
    });
  } catch (e) {
    console.error("❌ Erreur listByOrder transactions:", e);
    return res.status(500).json({
      error: "Erreur lors de la récupération des transactions de cette commande",
    });
  }
};
