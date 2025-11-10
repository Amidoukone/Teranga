'use strict';

const { Op } = require('sequelize');
const { OrderItem, Order, Product, User } = require('../../models');
const {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  ORDER_PAYMENT_STATUSES,
  PAYMENT_METHODS,
  ORDER_CHANNELS,
  getLabel,
  formatCurrency,
} = require('../utils/labels');

/* ============================================================
   🔧 Helpers utilitaires
============================================================ */
function toSafeInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function toTrimOrNull(v) {
  const s = (v ?? '').toString().trim();
  return s.length ? s : null;
}

function toNullableNumber(v) {
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function getPagination(req, defLimit = 100, maxLimit = 500) {
  const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || defLimit, 1), maxLimit);
  const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}

/**
 * 🔍 Récupère l’orderId depuis (ordre de priorité) :
 * - req.params.orderId (routes imbriquées: /orders/:orderId/items)
 * - req.body.orderId
 * - req.query.orderId
 */
function getOrderId(req) {
  return (
    toSafeInt(req.params?.orderId) ||
    toSafeInt(req.body?.orderId) ||
    toSafeInt(req.query?.orderId)
  );
}

/* ============================================================
   🏷️ Labels & aliases
============================================================ */
function withItemLabels(item) {
  if (!item) return null;
  const it = item.toJSON ? item.toJSON() : item;

  return {
    ...it,
    statusLabel: getLabel(it.status, ORDER_ITEM_STATUSES),
    // 🔁 alias compatibilité frontend
    itemStatus: it.status ?? null,
    lineTotal: it.total ?? Number(it.quantity || 0) * Number(it.unitPrice || 0),
  };
}

function withOrderLabels(order) {
  if (!order) return null;
  const o = order.toJSON ? order.toJSON() : order;

  const out = {
    ...o,
    statusLabel: getLabel(o.status, ORDER_STATUSES),
    paymentStatusLabel: getLabel(o.paymentStatus, ORDER_PAYMENT_STATUSES),
    paymentMethodLabel: getLabel(o.paymentMethod, PAYMENT_METHODS),
    channelLabel: getLabel(o.channel, ORDER_CHANNELS),
    currencyLabel: formatCurrency(o.currency),

    // 🔁 Aliases legacy consommés par le frontend
    orderStatus: o.status,
    customerNote: o.notes ?? null,
    totalAmount: o.total ?? 0,
  };

  if (Array.isArray(out.items)) {
    out.items = out.items.map(withItemLabels);
  }

  return out;
}

/* ============================================================
   🔐 ACL (héritée de la commande)
============================================================ */
function canReadOnOrder(user, order) {
  if (!user || !order) return false;
  if (['admin', 'agent'].includes(user.role)) return true;
  if (user.role === 'client') return order.userId === user.id;
  return false;
}

function canWriteOnOrder(user, order) {
  if (!user || !order) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'client') {
    // Le client ne peut écrire que si sa commande n’est pas finalisée
    return order.userId === user.id && ['created', 'processing'].includes(order.status);
  }
  return false; // agent : lecture seule
}

/* ============================================================
   🧮 Recalcul totaux commande (prix + taxes + livraison)
============================================================ */
async function recomputeOrderTotals(orderId) {
  const items = await OrderItem.findAll({ where: { orderId } });
  let subtotal = 0;

  for (const it of items) {
    const qty = Math.max(parseFloat(it.quantity || 0), 0);
    const price = Math.max(parseFloat(it.unitPrice || 0), 0);
    const line = qty * price;

    if (line !== it.total) {
      it.total = line;
      await it.save();
    }

    subtotal += line;
  }

  const ord = await Order.findByPk(orderId);
  if (!ord) return null;

  const total =
    (subtotal || 0) +
    parseFloat(ord.tax || 0) +
    parseFloat(ord.shipping || 0);

  ord.subtotal = subtotal;
  ord.total = Number(total.toFixed(2));
  await ord.save();

  return ord;
}

/* ============================================================
   1️⃣ CREATE — /orders/:orderId/items ou /order-items
============================================================ */
exports.create = async (req, res) => {
  try {
    const orderId = getOrderId(req);
    if (!orderId) return res.status(400).json({ error: 'orderId requis' });

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (!canWriteOnOrder(req.user, order)) return res.status(403).json({ error: 'Accès interdit' });

    const { productId, name, sku, unitPrice, quantity, status = 'created' } = req.body || {};

    // Vérifie si le produit existe
    let product = null;
    if (productId) {
      const pid = toSafeInt(productId);
      product = pid ? await Product.findByPk(pid) : null;
    }

    const item = await OrderItem.create({
      orderId: order.id,
      productId: product ? product.id : toSafeInt(productId),
      name: toTrimOrNull(name) || product?.name || '—',
      sku: toTrimOrNull(sku) || product?.sku || null,
      unitPrice: toNullableNumber(unitPrice) ?? (product?.price ?? 0),
      quantity: toSafeInt(quantity) ?? 1,
      total: 0,
      status: String(status).trim(),
    });

    // Recalcul commande
    const updatedOrder = await recomputeOrderTotals(order.id);

    const created = await OrderItem.findByPk(item.id, {
      include: [{ model: Product, as: 'product' }],
    });

    const orderWithLabels = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName', 'role'] },
        { model: OrderItem, as: 'items' },
      ],
    });

    res.status(201).json({
      item: withItemLabels(created),
      order: withOrderLabels(orderWithLabels || updatedOrder),
    });
  } catch (e) {
    console.error('❌ create orderItem:', e);
    res.status(500).json({ error: "Erreur lors de l'ajout de l'article à la commande." });
  }
};

/* ============================================================
   2️⃣ LIST — Items d’une commande
============================================================ */
exports.list = async (req, res) => {
  try {
    const orderId = getOrderId(req);
    if (!orderId) return res.status(400).json({ error: 'orderId requis' });

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (!canReadOnOrder(req.user, order)) return res.status(403).json({ error: 'Accès interdit' });

    const { limit, offset, page } = getPagination(req);

    const { rows, count } = await OrderItem.findAndCountAll({
      where: { orderId },
      include: [{ model: Product, as: 'product' }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      items: rows.map(withItemLabels),
      pagination: { page, limit, count },
    });
  } catch (e) {
    console.error('❌ list orderItems:', e);
    res.status(500).json({ error: 'Erreur lors de la récupération des articles.' });
  }
};

/* ============================================================
   3️⃣ UPDATE — Modification d’un article
============================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID d’article invalide' });

    const item = await OrderItem.findByPk(id);
    if (!item) return res.status(404).json({ error: 'Article introuvable' });

    const order = await Order.findByPk(item.orderId);
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (!canWriteOnOrder(req.user, order)) return res.status(403).json({ error: 'Accès interdit' });

    const { name, sku, unitPrice, quantity, status } = req.body || {};

    if (name !== undefined) item.name = toTrimOrNull(name) || item.name;
    if (sku !== undefined) item.sku = toTrimOrNull(sku);
    if (unitPrice !== undefined) item.unitPrice = toNullableNumber(unitPrice) ?? item.unitPrice;
    if (quantity !== undefined) item.quantity = toSafeInt(quantity) ?? item.quantity;
    if (status !== undefined) item.status = String(status).trim();

    await item.save();

    // Recalcul commande
    await recomputeOrderTotals(order.id);

    const updated = await OrderItem.findByPk(item.id, {
      include: [{ model: Product, as: 'product' }],
    });

    const orderWithLabels = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName', 'role'] },
        { model: OrderItem, as: 'items' },
      ],
    });

    res.json({
      item: withItemLabels(updated),
      order: withOrderLabels(orderWithLabels),
    });
  } catch (e) {
    console.error('❌ update orderItem:', e);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'article." });
  }
};

/* ============================================================
   4️⃣ DELETE — Suppression d’un article
============================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID article invalide' });

    const item = await OrderItem.findByPk(id);
    if (!item) return res.status(404).json({ error: 'Article introuvable' });

    const order = await Order.findByPk(item.orderId, {
      include: [{ model: User, as: 'user', attributes: ['id', 'email'] }],
    });
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });

    // Permissions
    const isClientAllowed =
      req.user.role === 'client' &&
      order.userId === req.user.id &&
      ['created', 'processing'].includes(order.status);

    if (!(req.user.role === 'admin' || isClientAllowed)) {
      return res.status(403).json({ error: 'Suppression non autorisée.' });
    }

    await item.destroy();

    // Recalcul commande
    await recomputeOrderTotals(order.id);

    const orderWithLabels = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: 'items' }],
    });

    res.json({
      message: 'Article supprimé avec succès.',
      order: withOrderLabels(orderWithLabels),
    });
  } catch (e) {
    console.error('❌ remove orderItem:', e);
    res.status(500).json({ error: "Erreur lors de la suppression de l'article." });
  }
};
