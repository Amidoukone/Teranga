'use strict';

const { Op } = require('sequelize');
const { Transaction, User, Service, Task, Order, Project } = require('../../models');
const {
  toSafeInt,
  toTrimOrNull,
  getPagination,
  buildWhereWithACL,
  canAccessTransaction,
  COMMON_INCLUDE,
} = require('../services/transaction.service');

const imagekit = require('../helpers/teranga-imagekit'); // ⭐ IMAGEKIT

// 🌍 Labels FR
const {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  CURRENCY_LABELS,
  getLabel,
} = require('../utils/labels');

// ✅ Jeux de validation
const ALLOWED_TYPES = new Set(Object.keys(TRANSACTION_TYPES || {}));
const ALLOWED_STATUSES = new Set(Object.keys(TRANSACTION_STATUSES || {}));
const KNOWN_CURRENCIES = new Set(Object.keys(CURRENCY_LABELS || {}));

/* ============================================================
   🧰 Helpers
============================================================ */
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
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function normalizeCurrency(input, fallback = 'XOF') {
  if (!input) return fallback;
  const cur = String(input).toUpperCase().trim();
  return KNOWN_CURRENCIES.has(cur) ? cur : fallback;
}

/**
 * 🔍 Récupère un fichier uploadé de manière robuste (single/array/fields)
 */
function extractUploadFile(req) {
  if (req.file) return req.file;
  if (Array.isArray(req.files) && req.files.length) return req.files[0];

  if (req.files && typeof req.files === 'object') {
    const candidates = ['proofFile', 'file', 'attachment', 'files', 'proof'];
    for (const key of candidates) {
      const arr = req.files[key];
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    }
  }
  return null;
}

/* ============================================================
   1️⃣ CREATE — Upload proofFile → ImageKit
============================================================ */
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
      status, // seulement admin
    } = req.body || {};

    if (!type) return res.status(400).json({ error: 'Type de transaction requis' });

    const txType = String(type).trim();
    if (!ALLOWED_TYPES.has(txType))
      return res.status(400).json({ error: 'Type de transaction invalide' });

    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null)
      return res.status(400).json({ error: 'Montant invalide' });

    const sid = toSafeInt(serviceId);
    const tid = toSafeInt(taskId);
    const oid = toSafeInt(orderId);
    const pid = toSafeInt(projectId);

    let service = sid ? await Service.findByPk(sid) : null;
    let task = tid ? await Task.findByPk(tid) : null;
    let order = oid ? await Order.findByPk(oid) : null;
    let project = pid ? await Project.findByPk(pid) : null;

    /* ---------------------------
       ⭐ Upload via ImageKit
    ---------------------------- */
    const up = extractUploadFile(req);
    let proofFile = null;

    if (up) {
      const upload = await imagekit.upload({
        file: up.buffer,
        fileName: `transaction_${Date.now()}_${up.originalname}`,
        folder: '/teranga/transactions/',
      });

      proofFile = {
        url: upload.url,
        fileId: upload.fileId,
        originalName: up.originalname,
        mimeType: up.mimetype,
        size: up.size,
      };
    }

    const actorUserId = req.user.id;
    const ownerUserId = order?.userId || actorUserId;

    const payload = {
      userId: ownerUserId,
      serviceId: service?.id || sid || null,
      taskId: task?.id || tid || null,
      orderId: order?.id || oid || null,
      projectId: project?.id || pid || null,
      type: txType,
      amount: parsedAmount,
      currency: normalizeCurrency(currency, 'XOF'),
      paymentMethod: toTrimOrNull(paymentMethod),
      description: toTrimOrNull(description),
      proofFile,
      status: 'pending',
    };

    if (order && ['paid', 'delivered'].includes(order.status)) {
      payload.status = 'completed';
    } else if (project || !order) {
      payload.status = 'completed';
    }

    if (status && req.user.role === 'admin') {
      const s = String(status).trim();
      if (!ALLOWED_STATUSES.has(s))
        return res.status(400).json({ error: 'Statut invalide' });
      payload.status = s;
    }

    // ✔ Évite doublons
    const existing = order
      ? await Transaction.findOne({
          where: { orderId: order.id, userId: ownerUserId, type: txType },
        })
      : null;

    let created;
    if (existing) {
      existing.amount = parsedAmount;
      if (existing.status !== 'completed' && payload.status === 'completed') {
        existing.status = 'completed';
      }
      await existing.save();
      created = existing;
    } else {
      const trx = await Transaction.create(payload);
      created = await Transaction.findByPk(trx.id, {
        include: COMMON_INCLUDE.concat([
          { model: Order, as: 'order' },
          { model: Project, as: 'project' },
        ]),
      });
    }

    return res.status(201).json({
      message: 'Transaction enregistrée',
      transaction: withLabels(created),
    });
  } catch (e) {
    console.error('❌ Erreur création transaction:', e);
    return res.status(500).json({ error: "Erreur lors de l'ajout de la transaction" });
  }
};

/* ============================================================
   2️⃣ LIST — inchangé
============================================================ */
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

    if (type) where.type = String(type).trim();
    if (status) where.status = String(status).trim();
    if (currency) where.currency = String(currency).toUpperCase().trim();
    if (paymentMethod)
      where.paymentMethod = { [Op.like]: `%${paymentMethod}%` };

    const oid = toSafeInt(orderId);
    const sid = toSafeInt(serviceId);
    const tid = toSafeInt(taskId);
    const pid = toSafeInt(projectId);

    if (oid) where.orderId = oid;
    if (sid) where.serviceId = sid;
    if (tid) where.taskId = tid;
    if (pid) where.projectId = pid;

    const minA = parseAmount(minAmount);
    const maxA = parseAmount(maxAmount);
    if (minA !== null || maxA !== null) {
      where.amount = {};
      if (minA !== null) where.amount[Op.gte] = minA;
      if (maxA !== null) where.amount[Op.lte] = maxA;
    }

    if (startDate || endDate) {
      const start = startDate
        ? new Date(startDate)
        : new Date('1970-01-01T00:00:00Z');
      const end = endDate ? new Date(endDate) : new Date();
      where.createdAt = { [Op.between]: [start, end] };
    }

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

    const sortKey = sort ? sort.replace(/^-/, '') : 'createdAt';
    const sortDir = sort && sort.startsWith('-') ? 'DESC' : 'ASC';

    const { rows, count } = await Transaction.findAndCountAll({
      where,
      include: COMMON_INCLUDE.concat([
        { model: Order, as: 'order' },
        { model: Project, as: 'project' },
      ]),
      order: [[sortKey, sortDir]],
      limit,
      offset,
      distinct: true,
    });

    res.json({
      transactions: rows.map(withLabels),
      pagination: { page, limit, total: count },
    });
  } catch (e) {
    console.error('❌ Erreur list transactions:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
  }
};

/* ============================================================
   3️⃣ DETAIL — inchangé
============================================================ */
exports.detail = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id)
      return res.status(400).json({ error: 'ID invalide' });

    const trx = await Transaction.findByPk(id, {
      include: COMMON_INCLUDE.concat([
        { model: Order, as: 'order' },
        { model: Project, as: 'project' },
      ]),
    });

    if (!trx)
      return res.status(404).json({ error: 'Transaction introuvable' });

    const allowed = await canAccessTransaction(req, trx);
    if (!allowed)
      return res.status(403).json({ error: 'Accès interdit' });

    res.json({ transaction: withLabels(trx) });
  } catch (e) {
    console.error('❌ Erreur detail transaction:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération de la transaction' });
  }
};

/* ============================================================
   4️⃣ UPDATE — upload ImageKit + suppression ancienne preuve
============================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id)
      return res.status(400).json({ error: 'ID invalide' });

    const trx = await Transaction.findByPk(id, {
      include: COMMON_INCLUDE.concat([
        { model: Order, as: 'order' },
        { model: Project, as: 'project' },
      ]),
    });

    if (!trx)
      return res.status(404).json({ error: 'Transaction introuvable' });

    const allowed = await canAccessTransaction(req, trx);
    if (!allowed)
      return res.status(403).json({ error: 'Accès interdit' });

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
    } = req.body || {};

    if (description !== undefined)
      trx.description = toTrimOrNull(description);

    if (paymentMethod !== undefined)
      trx.paymentMethod = toTrimOrNull(paymentMethod);

    /* ======================================================
       ⭐ Upload nouvelle preuve via ImageKit
    ======================================================= */
    const up = extractUploadFile(req);
    if (up) {
      // supprime ancienne preuve si existe
      if (trx.proofFile?.fileId) {
        try {
          await imagekit.deleteFile(trx.proofFile.fileId);
        } catch (err) {
          console.warn('⚠️ Impossible de supprimer ancienne preuve:', err.message);
        }
      }

      const upload = await imagekit.upload({
        file: up.buffer,
        fileName: `transaction_${id}_${Date.now()}_${up.originalname}`,
        folder: '/teranga/transactions/',
      });

      trx.proofFile = {
        url: upload.url,
        fileId: upload.fileId,
        originalName: up.originalname,
        mimeType: up.mimetype,
        size: up.size,
      };
    }

    if (serviceId !== undefined)
      trx.serviceId = toSafeInt(serviceId) || null;

    if (taskId !== undefined)
      trx.taskId = toSafeInt(taskId) || null;

    if (orderId !== undefined) {
      const newOid = toSafeInt(orderId);
      if (newOid) {
        const newOrder = await Order.findByPk(newOid);
        if (!newOrder)
          return res.status(400).json({ error: 'Commande cible introuvable' });

        trx.orderId = newOrder.id;
        trx.userId = newOrder.userId;
      } else {
        trx.orderId = null;
      }
    }

    if (projectId !== undefined) {
      const newPid = toSafeInt(projectId);
      if (newPid) {
        const newProject = await Project.findByPk(newPid);
        if (!newProject)
          return res.status(400).json({ error: 'Projet cible introuvable' });

        trx.projectId = newProject.id;
      } else {
        trx.projectId = null;
      }
    }

    const isAdmin = req.user.role === 'admin';

    if (status !== undefined) {
      const s = String(status).trim();
      if (!ALLOWED_STATUSES.has(s))
        return res.status(400).json({ error: 'Statut invalide' });
      if (!isAdmin)
        return res.status(403).json({ error: 'Seul un admin peut modifier le statut' });
      trx.status = s;
    }

    if (currency !== undefined) {
      if (!isAdmin)
        return res.status(403).json({ error: 'Seul un admin peut modifier la devise' });
      trx.currency = normalizeCurrency(currency, trx.currency || 'XOF');
    }

    if (type !== undefined) {
      if (!isAdmin)
        return res.status(403).json({ error: 'Seul un admin peut modifier le type' });
      const t = String(type).trim();
      if (!ALLOWED_TYPES.has(t))
        return res.status(400).json({ error: 'Type invalide' });
      trx.type = t;
    }

    if (amount !== undefined) {
      if (!isAdmin)
        return res.status(403).json({ error: 'Seul un admin peut modifier le montant' });
      const n = parseAmount(amount);
      if (n === null)
        return res.status(400).json({ error: 'Montant invalide' });
      trx.amount = n;
    }

    if (trx.order && ['paid', 'delivered'].includes(trx.order.status)) {
      trx.status = 'completed';
    }

    await trx.save();

    const updated = await Transaction.findByPk(trx.id, {
      include: COMMON_INCLUDE.concat([
        { model: Order, as: 'order' },
        { model: Project, as: 'project' },
      ]),
    });

    res.json({
      message: 'Transaction mise à jour',
      transaction: withLabels(updated),
    });
  } catch (e) {
    console.error('❌ Erreur update transaction:', e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la transaction' });
  }
};

/* ============================================================
   5️⃣ DELETE — admin ou owner pending + delete ImageKit
============================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id)
      return res.status(400).json({ error: 'ID invalide' });

    const trx = await Transaction.findByPk(id);
    if (!trx)
      return res.status(404).json({ error: 'Transaction introuvable' });

    const isOwner = req.user && trx.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!(isAdmin || (isOwner && trx.status === 'pending'))) {
      return res.status(403).json({ error: 'Suppression non autorisée' });
    }

    // ⭐ Supprime la preuve dans ImageKit
    if (trx.proofFile?.fileId) {
      try {
        await imagekit.deleteFile(trx.proofFile.fileId);
      } catch (err) {
        console.warn('⚠️ Impossible de supprimer la preuve ImageKit:', err.message);
      }
    }

    await trx.destroy();

    return res.json({ message: 'Transaction supprimée' });
  } catch (e) {
    console.error('❌ Erreur suppression transaction:', e);
    res.status(500).json({ error: 'Erreur lors de la suppression du fichier' });
  }
};

/* ============================================================
   6️⃣ SUMMARY / REPORT / LISTBYORDER — inchangés
============================================================ */
exports.summary = async (_req, res) => {
  try {
    const [revenues, expenses, commissions, adjustments] = await Promise.all([
      Transaction.sum('amount', { where: { type: 'revenue' } }),
      Transaction.sum('amount', { where: { type: 'expense' } }),
      Transaction.sum('amount', { where: { type: 'commission' } }),
      Transaction.sum('amount', { where: { type: 'adjustment' } }),
    ]);

    const balance =
      (revenues || 0) - (expenses || 0) - (commissions || 0) + (adjustments || 0);
    res.json({ revenues, expenses, commissions, adjustments, balance });
  } catch (e) {
    console.error('❌ Erreur summary:', e);
    res.status(500).json({ error: 'Erreur lors du calcul du résumé financier' });
  }
};

exports.report = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 864e5);
    const end = endDate ? new Date(endDate) : new Date();
    const where = { createdAt: { [Op.between]: [start, end] } };

    const transactions = await Transaction.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'role'] },
        { model: Order, as: 'order', attributes: ['id', 'code', 'status'] },
        { model: Project, as: 'project', attributes: ['id', 'title', 'status'] },
      ],
      order: [['createdAt', 'ASC']],
    });

    const totals = { revenue: 0, expense: 0, commission: 0, adjustment: 0 };
    transactions.forEach((t) => {
      totals[t.type] = (totals[t.type] || 0) + parseFloat(t.amount || 0);
    });

    const totalsWithLabels = Object.entries(totals).map(([key, value]) => ({
      type: key,
      typeLabel: getLabel(key, TRANSACTION_TYPES),
      amount: value,
    }));

    res.json({
      period: { start, end },
      count: transactions.length,
      totals,
      totalsWithLabels,
    });
  } catch (e) {
    console.error('❌ Erreur report:', e);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport' });
  }
};

exports.listByOrder = async (req, res) => {
  try {
    const orderId = toSafeInt(req.params.id);
    if (!orderId)
      return res.status(400).json({ error: 'orderId invalide' });

    const where = buildWhereWithACL(req);
    where.orderId = orderId;

    const { limit, offset, page } = getPagination(req);

    const { rows, count } = await Transaction.findAndCountAll({
      where,
      include: COMMON_INCLUDE.concat([{ model: Order, as: 'order' }]),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    res.json({
      transactions: rows.map(withLabels),
      pagination: { page, limit, total: count },
    });
  } catch (e) {
    console.error('❌ Erreur listByOrder transactions:', e);
    res.status(500).json({
      error: "Erreur lors de la récupération des transactions de l'ordre",
    });
  }
};
