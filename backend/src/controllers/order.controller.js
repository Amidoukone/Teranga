'use strict';

const { Op } = require('sequelize');
const { Order, OrderItem, User, Product, Transaction } = require('../../models'); // ✅ Transaction + Product
const {
  ORDER_STATUSES,
  ORDER_PAYMENT_STATUSES,
  PAYMENT_METHODS,
  ORDER_CHANNELS,
  CURRENCY_LABELS,
  getLabel,
  formatCurrency,
} = require('../utils/labels');

/* ============================================================
   🔧 Helpers
============================================================ */
function toSafeInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function toTrimOrNull(v) {
  const s = (v ?? '').toString().trim();
  return s.length ? s : null;
}

function toNullableNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function getPagination(req, defLimit = 50, maxLimit = 200) {
  const limit = Math.min(
    Math.max(parseInt(req.query?.limit, 10) || defLimit, 1),
    maxLimit
  );
  const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  return { limit, offset, page };
}

/**
 * ✅ Normalise un payload venant du frontend (legacy & nouveau)
 */
function normalizeOrderPayload(body = {}) {
  return {
    status: body.orderStatus ?? body.status ?? 'created',
    paymentStatus: body.paymentStatus ?? 'unpaid',
    paymentMethod: body.paymentMethod ?? 'other',
    channel: body.channel ?? 'web',
    currency: body.currency ?? 'XOF',
    subtotal: body.subtotal ?? null,
    tax: body.tax ?? null,
    shipping: body.shipping ?? null,
    discount: body.discount ?? null,
    total: body.totalAmount ?? body.total ?? null,
    note: body.customerNote ?? body.note ?? null,
    userId: body.userId ?? null,
    items: body.items ?? [],
    countryId: body.countryId ?? body.country_id ?? null,
    regionId: body.regionId ?? body.region_id ?? null,
  };
}

/**
 * ✅ Ajoute labels + alias legacy pour compat totale avec le frontend
 */
function withLabels(o) {
  if (!o) return null;
  const order = o.toJSON ? o.toJSON() : o;

  const out = {
    ...order,
    statusLabel: getLabel(order.status, ORDER_STATUSES),
    paymentStatusLabel: getLabel(order.paymentStatus, ORDER_PAYMENT_STATUSES),
    paymentMethodLabel: getLabel(order.paymentMethod, PAYMENT_METHODS),
    channelLabel: getLabel(order.channel, ORDER_CHANNELS),
    currencyLabel: formatCurrency(order.currency),

    // legacy compat
    orderStatus: order.status,
    customerNote: order.notes ?? null,
    totalAmount: order.total ?? 0,
  };

  if (!out.customer && out.user) out.customer = out.user;

  if (Array.isArray(out.items)) {
    out.items = out.items.map((it) => ({
      ...it,
      itemStatus: it.status ?? null,
      lineTotal: it.total ?? Number(it.quantity || 0) * Number(it.price || 0),
    }));
  }

  return out;
}

/* ============================================================
   🔐 ACL
============================================================ */
function canReadOrder(user, order) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'agent') return true;
  if (user.role === 'client') return order?.userId === user.id;
  return false;
}

function canWriteOrder(user, order = null) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'client') {
    if (!order) return true;
    return (
      order.userId === user.id && ['created', 'processing'].includes(order.status)
    );
  }
  return false;
}

/* ============================================================
   🧮 Recalcul total côté serveur
============================================================ */
async function recomputeTotals(orderId) {
  const items = await OrderItem.findAll({ where: { orderId } });
  let subtotal = 0;

  for (const it of items) {
    const qty = Math.max(parseFloat(it.quantity || 0), 0);
    const price = Math.max(parseFloat(it.price || 0), 0);
    const line = qty * price;

    if (line !== it.total) {
      it.total = line;
      await it.save();
    }
    subtotal += line;
  }

  return { subtotal };
}

/* ============================================================
   🔁 Synchronisation automatique statut ↔ paiement
============================================================ */
function syncPaymentStatus(order) {
  if (['paid', 'fulfilled', 'delivered'].includes(order.status)) {
    order.paymentStatus = 'paid';
  } else if (['cancelled', 'refunded'].includes(order.status)) {
    order.paymentStatus = 'refunded';
  }
}

/* ============================================================
   1️⃣ CREATE — Crée une commande complète (+ gestion stock)
============================================================ */
exports.create = async (req, res) => {
  try {
    if (!canWriteOrder(req.user, null)) {
      return res.status(403).json({ error: 'Accès interdit' });
    }

    const norm = normalizeOrderPayload(req.body);

    const ownerId =
      req.user.role === 'admin'
        ? toSafeInt(norm.userId) || req.user.id
        : req.user.id;

    // ✅ scope multi-pays (nullable)
    const scopeCountryId = toSafeInt(norm.countryId);
    const scopeRegionId = toSafeInt(norm.regionId);

    // 1) Création de la commande (sans items pour l’instant)
    const order = await Order.create({
      userId: ownerId,
      status: norm.status,
      paymentStatus: norm.paymentStatus,
      paymentMethod: norm.paymentMethod,
      currency: String(norm.currency || 'XOF').toUpperCase(),
      subtotal: toNullableNumber(norm.subtotal) ?? 0,
      tax: toNullableNumber(norm.tax) ?? 0,
      shipping: toNullableNumber(norm.shipping) ?? 0,
      total: 0,
      notes: toTrimOrNull(norm.note),

      // ✅ multi-pays
      countryId: scopeCountryId,
      regionId: scopeRegionId,
    });

    const items = Array.isArray(norm.items) ? norm.items : [];

    /* --------------------------------------------------------
       2) Prévalidation des stocks pour tous les items
    -------------------------------------------------------- */
    const qtyByProductId = new Map();

    for (const it of items) {
      const pid = toSafeInt(it.productId);
      const qty = toSafeInt(it.quantity) ?? 1;
      if (!pid || !qty || qty <= 0) continue;
      qtyByProductId.set(pid, (qtyByProductId.get(pid) || 0) + qty);
    }

    const productsById = new Map();

    if (qtyByProductId.size > 0) {
      const productIds = [...qtyByProductId.keys()];
      const products = await Product.findAll({ where: { id: productIds } });
      products.forEach((p) => productsById.set(p.id, p));

      for (const [pid, totalQty] of qtyByProductId.entries()) {
        const product = productsById.get(pid);
        if (!product) continue;

        const rawStock = product.stock;
        if (rawStock === null || typeof rawStock === 'undefined') continue;

        const currentStock = Number(rawStock);
        if (!Number.isNaN(currentStock) && currentStock < totalQty) {
          await order.destroy(); // rollback commande vide
          return res.status(400).json({
            error: `Stock insuffisant pour le produit "${product.name}". Disponible : ${currentStock}, demandé : ${totalQty}.`,
          });
        }
      }
    }

    /* --------------------------------------------------------
       3) Création des OrderItem + décrémentation du stock
    -------------------------------------------------------- */
    if (items.length > 0) {
      for (const it of items) {
        const pid = toSafeInt(it.productId);

        let product = pid ? productsById.get(pid) : null;
        if (!product && pid) product = await Product.findByPk(pid);

        const name = product ? product.name : it.name || '—';
        const price =
          toNullableNumber(it.unitPrice) ?? (product ? product.price : 0);
        const qty = toSafeInt(it.quantity) ?? 1;

        await OrderItem.create({
          orderId: order.id,
          productId: pid || null,
          name,
          sku: product?.sku || null,
          price,
          quantity: qty,
          total: price * qty,
        });

        if (product && product.stock !== null && typeof product.stock !== 'undefined') {
          const currentStock = Number(product.stock);
          if (!Number.isNaN(currentStock)) {
            product.stock = currentStock - qty;
            await product.save();
          }
        }
      }
    }

    /* --------------------------------------------------------
       4) Recalcul total + sync statut/paiement
    -------------------------------------------------------- */
    const { subtotal } = await recomputeTotals(order.id);
    const total =
      subtotal + parseFloat(order.tax || 0) + parseFloat(order.shipping || 0);

    order.subtotal = subtotal;
    order.total = total;

    syncPaymentStatus(order);
    await order.save();

    const created = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: OrderItem, as: 'items' },
      ],
    });

    return res.status(201).json({ order: withLabels(created) });
  } catch (e) {
    console.error('❌ create order:', e);
    const msg = e?.message || '';
    if (msg.toLowerCase().includes('stock insuffisant')) {
      return res.status(400).json({ error: msg });
    }
    return res
      .status(500)
      .json({ error: 'Erreur lors de la création de la commande.' });
  }
};

/* ============================================================
   2️⃣ LIST — Liste paginée + filtres (+ multi-pays)
============================================================ */
exports.list = async (req, res) => {
  try {
    const { limit, offset, page } = getPagination(req);

    const q = toTrimOrNull(req.query?.q);
    const status = toTrimOrNull(req.query?.status);
    const paymentStatus = toTrimOrNull(req.query?.paymentStatus);
    const userId = toSafeInt(req.query?.userId);

    // ✅ multi-pays filters
    const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
    const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);

    const where = {};

    if (q) {
      where[Op.or] = [
        { notes: { [Op.like]: `%${q}%` } },
        { code: { [Op.like]: `%${q}%` } },
      ];
    }
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (req.user.role === 'client') {
      where.userId = req.user.id;
      // ⚠️ On ne force pas country/region ici pour ne pas casser legacy,
      // mais si le frontend les envoie, on peut filtrer.
      if (countryId) where.countryId = countryId;
      if (regionId) where.regionId = regionId;
    } else {
      if (userId) where.userId = userId;
      if (countryId) where.countryId = countryId;
      if (regionId) where.regionId = regionId;
    }

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      orders: rows.map(withLabels),
      pagination: { page, limit, count },
    });
  } catch (e) {
    console.error('❌ list orders:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des commandes.' });
  }
};

/* ============================================================
   3️⃣ DETAIL — Une commande
============================================================ */
exports.detail = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide' });

    const order = await Order.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: OrderItem, as: 'items' },
      ],
    });

    if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
    if (!canReadOrder(req.user, order)) {
      return res.status(403).json({ error: 'Accès interdit.' });
    }

    return res.json({ order: withLabels(order) });
  } catch (e) {
    console.error('❌ detail order:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la récupération de la commande.' });
  }
};

/* ============================================================
   4️⃣ UPDATE — Mise à jour + multi-pays + cohérence transaction
============================================================ */
exports.update = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide.' });

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
    if (!canWriteOrder(req.user, order)) {
      return res.status(403).json({ error: 'Accès interdit.' });
    }

    const norm = normalizeOrderPayload(req.body);

    if (norm.status) order.status = norm.status;
    if (norm.paymentStatus) order.paymentStatus = norm.paymentStatus;
    if (norm.paymentMethod) order.paymentMethod = norm.paymentMethod;
    if (norm.currency) order.currency = String(norm.currency).toUpperCase();
    if (norm.tax !== null) order.tax = toNullableNumber(norm.tax) ?? 0;
    if (norm.shipping !== null) order.shipping = toNullableNumber(norm.shipping) ?? 0;
    if (norm.note !== undefined) order.notes = toTrimOrNull(norm.note);

    // ✅ multi-pays update: admin uniquement (anti-régression / anti-spoof)
    if (req.user.role === 'admin') {
      if (norm.countryId !== null && norm.countryId !== undefined) {
        order.countryId = toSafeInt(norm.countryId);
      }
      if (norm.regionId !== null && norm.regionId !== undefined) {
        order.regionId = toSafeInt(norm.regionId);
      }
    }

    const { subtotal } = await recomputeTotals(order.id);
    const total =
      subtotal + parseFloat(order.tax || 0) + parseFloat(order.shipping || 0);

    order.subtotal = subtotal;
    order.total = total;

    // ✅ Synchronisation statut/paiement
    syncPaymentStatus(order);
    await order.save();

    /* ============================================================
       💳 Création/MAJ automatique de transaction
       si commande payée ou livrée
    ============================================================ */
    if (['paid', 'delivered'].includes(order.status)) {
      try {
        const existingTx = await Transaction.findOne({
          where: { orderId: order.id, userId: order.userId, type: 'expense' },
        });

        if (!existingTx) {
          await Transaction.create({
            userId: order.userId,
            orderId: order.id,
            type: 'expense',
            amount: order.total || 0,
            currency: order.currency || 'XOF',
            paymentMethod: order.paymentMethod || 'inconnu',
            description: `Paiement de la commande ${order.code || `#${order.id}`}`,
            status: 'completed',

            // ✅ scope multi-pays (si ta Transaction a ces champs)
            countryId: order.countryId ?? null,
            regionId: order.regionId ?? null,
          });
          console.log(`✅ Transaction automatique créée pour la commande ${order.id}`);
        } else if (existingTx.status !== 'completed') {
          existingTx.status = 'completed';

          // ✅ (safe) aligner scope si manquant
          if (existingTx.countryId == null && order.countryId != null) {
            existingTx.countryId = order.countryId;
          }
          if (existingTx.regionId == null && order.regionId != null) {
            existingTx.regionId = order.regionId;
          }

          await existingTx.save();
          console.log(`🔄 Transaction ${existingTx.id} mise à jour en "completed"`);
        }
      } catch (err) {
        console.error('⚠️ Erreur transaction automatique commande:', err);
      }
    }

    const updated = await Order.findByPk(order.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: OrderItem, as: 'items' },
      ],
    });

    return res.json({ order: withLabels(updated) });
  } catch (e) {
    console.error('❌ update order:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour de la commande.' });
  }
};

/* ============================================================
   5️⃣ DELETE
============================================================ */
exports.remove = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID invalide.' });

    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

    if (req.user.role === 'client') {
      if (
        order.userId !== req.user.id ||
        !['created', 'processing'].includes(order.status)
      ) {
        return res.status(403).json({ error: 'Suppression non autorisée.' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Suppression non autorisée.' });
    }

    const hasDelivered = (order.items || []).some((it) =>
      ['delivered', 'fulfilled', 'done'].includes(it.status)
    );
    if (hasDelivered) {
      return res.status(400).json({
        error: 'Impossible de supprimer une commande avec des articles livrés.',
      });
    }

    await order.destroy();
    return res.json({ message: 'Commande supprimée avec succès.' });
  } catch (e) {
    console.error('❌ remove order:', e);
    return res
      .status(500)
      .json({ error: 'Erreur lors de la suppression de la commande.' });
  }
};
