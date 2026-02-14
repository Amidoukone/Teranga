'use strict';

const { Op, col } = require('sequelize');
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
const { getPagination } = require('../utils/pagination');

// ✅ Geo-scope (model-aware)
const {
  applyGeoScopeForModel,
  filterGeoAssignmentsForModel,
  getUserGeoScope,
  getCountryIdByIso,
  isGlobalAdmin,
} = require('../utils/geoScope');

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

function buildOrderOrder(sort) {
  if (!sort) return [[col('Order.created_at'), 'DESC']];

  const raw = String(sort);
  const desc = raw.startsWith('-');
  const key = desc ? raw.slice(1) : raw;
  const dir = desc ? 'DESC' : 'ASC';

  switch (key) {
    case 'createdAt':
      return [[col('Order.created_at'), dir]];
    case 'totalAmount':
      return [[col('Order.total'), dir]];
    default:
      return [[col('Order.created_at'), 'DESC']];
  }
}

async function inferGeoFromUserId(userId) {
  if (!userId) return { countryId: null, regionId: null };

  const user = await User.findByPk(userId, {
    attributes: ['id', 'countryId', 'regionId', 'country'],
  });

  if (!user) return { countryId: null, regionId: null };

  let countryId = toSafeInt(user.countryId ?? user.country_id);
  let regionId = toSafeInt(user.regionId ?? user.region_id);

  if (!countryId && user.country) {
    countryId = await getCountryIdByIso(user.country);
  }

  return { countryId, regionId };
}

/* ============================================================
   🌍 Helpers Scope multi-pays (safe + rétro-compatible)
   - Admin global: admin sans scope => voit tout
   - Master: admin + scope countryId/regionId => filtré
============================================================ */
function readCountryIdFrom(obj) {
  return toSafeInt(obj?.countryId ?? obj?.country_id);
}

function readRegionIdFrom(obj) {
  return toSafeInt(obj?.regionId ?? obj?.region_id);
}

/**
 * Scope final à appliquer à la création :
 * - Admin global : peut définir via payload
 * - Admin scoped : scope imposé depuis req.user
 * - Agent : (si jamais autorisé un jour) scope imposé
 * - Client : rétro-compatible (ne force pas), accepte si fourni
 */
function getEffectiveScopeForCreate(req, norm) {
  const userScope = getUserGeoScope
    ? getUserGeoScope(req.user)
    : { countryId: null, regionId: null };

  if (isGlobalAdmin(req.user)) {
    return {
      countryId: toSafeInt(norm.countryId),
      regionId: toSafeInt(norm.regionId),
    };
  }

  // Admin scoped / agent : scope imposé
  if (req.user?.role === 'admin' || req.user?.role === 'agent') {
    return {
      countryId: userScope.countryId,
      regionId: userScope.regionId,
    };
  }

  // Client : scope imposé si défini, sinon fallback legacy
  if (req.user?.role === 'client') {
    if (userScope.countryId || userScope.regionId) {
      return {
        countryId: userScope.countryId,
        regionId: userScope.regionId,
      };
    }
  }

  // fallback legacy => accepte si fourni, ne force pas sinon
  return {
    countryId: toSafeInt(norm.countryId),
    regionId: toSafeInt(norm.regionId),
  };
}

/**
 * Applique un scope à un WHERE Order.
 * - Client: toujours userId = self, + scope optionnel si fourni en query
 * - Admin global: pas de filtre géographique
 * - Admin scoped: filtré via applyGeoScopeForModel
 * - Agent: filtré via applyGeoScopeForModel
 */
function applyOrderScopeWhere(
  where,
  req,
  { allowClientProvidedScope = true, allowLegacyUserScope = false } = {}
) {
  const role = req.user?.role;

  if (role === 'client') {
    const out = { ...where, userId: req.user.id };

    if (allowClientProvidedScope) {
      const qCountryId = readCountryIdFrom(req.query);
      const qRegionId = readRegionIdFrom(req.query);
      if (qCountryId) out.countryId = qCountryId;
      if (qRegionId) out.regionId = qRegionId;
    }

    return applyGeoScopeForModel
      ? applyGeoScopeForModel(out, req.user, Order, { includeClients: true })
      : out;
  }

  if (isGlobalAdmin(req.user)) return where;

  // Master/admin scoped + agent (model-aware)
  if (!allowLegacyUserScope) {
    return applyGeoScopeForModel ? applyGeoScopeForModel(where, req.user, Order) : where;
  }

  const scope = getUserGeoScope ? getUserGeoScope(req.user) : {};
  const scopeCountryId = toSafeInt(scope.countryId);
  const scopeRegionId = toSafeInt(scope.regionId);

  if (!scopeCountryId && !scopeRegionId) return { ...where, id: 0 };

  const or = [];

  if (scopeRegionId) {
    or.push({ regionId: scopeRegionId });
    or.push({
      [Op.and]: [
        { regionId: null },
        { countryId: null },
        { '$user.region_id$': scopeRegionId },
      ],
    });
  } else if (scopeCountryId) {
    or.push({ countryId: scopeCountryId });
    or.push({
      [Op.and]: [
        { regionId: null },
        { countryId: null },
        { '$user.country_id$': scopeCountryId },
      ],
    });
  }

  const andFilters = Array.isArray(where[Op.and]) ? [...where[Op.and]] : [];
  andFilters.push({ [Op.or]: or });

  return { ...where, [Op.and]: andFilters };
}

/**
 * Scope produit (création commande) :
 * - Admin global : pas de filtre
 * - Admin scoped / agent : filtre geo (model-aware)
 * - Client : pas de filtre geo (catalogue global), rétro-compatible
 */
function applyProductScopeWhere(where, req) {
  if (isGlobalAdmin(req.user)) return where;
  return applyGeoScopeForModel
    ? applyGeoScopeForModel(where, req.user, Product, { includeClients: true })
    : where;
}

/* ============================================================
   ✅ Normalise un payload venant du frontend (legacy & nouveau)
============================================================ */
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
  // Admin = global ou scoped, Agent = lecture
  if (user.role === 'admin' || user.role === 'agent') return true;
  if (user.role === 'client') return order?.userId === user.id;
  return false;
}

function canWriteOrder(user, order = null) {
  if (!user) return false;
  // Admin = global ou scoped
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

    // ✅ scope multi-pays (safe)
    const effectiveScope = getEffectiveScopeForCreate(req, norm);

    // ✅ fallback geo depuis le propriétaire (client)
    const fallbackGeo = await inferGeoFromUserId(ownerId);
    const finalScope = {
      countryId:
        effectiveScope.countryId ?? fallbackGeo.countryId ?? null,
      regionId:
        effectiveScope.regionId ?? fallbackGeo.regionId ?? null,
    };

    // 1) Création de la commande (sans items pour l’instant)
    // ✅ model-aware: on filtre les champs geo si le modèle ne les supporte pas
    const order = await Order.create(
      filterGeoAssignmentsForModel(Order, {
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
        countryId: finalScope.countryId,
        regionId: finalScope.regionId,
      })
    );

    const items = Array.isArray(norm.items) ? norm.items : [];

    /* --------------------------------------------------------
       2) Prévalidation des stocks pour tous les items
       ✅ Ajout scope produit : admin scoped ne peut pas commander hors scope
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

      // ✅ Filtre produits par scope (admin global => pas filtré)
      const products = await Product.findAll({
        where: applyProductScopeWhere({ id: productIds }, req),
      });

      products.forEach((p) => productsById.set(p.id, p));

      const userScope = getUserGeoScope
        ? getUserGeoScope(req.user)
        : { countryId: null, regionId: null };
      const hasUserScope = Boolean(userScope?.countryId || userScope?.regionId);
      const shouldEnforceProductScope =
        !isGlobalAdmin(req.user) &&
        ['admin', 'agent', 'client'].includes(req.user.role) &&
        hasUserScope;

      // Si scoped, et qu’un produit n’est pas visible => bloquer
      if (shouldEnforceProductScope) {
        for (const pid of productIds) {
          if (!productsById.has(pid)) {
            await order.destroy();
            return res.status(403).json({
              error: 'Produit hors scope géographique (accès interdit).',
            });
          }
        }
      }

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

        if (!product && pid) {
          // ✅ Respect scope produit
          product = await Product.findOne({
            where: applyProductScopeWhere({ id: pid }, req),
          });
        }

        const name = product ? product.name : it.name || '—';
        const price =
          toNullableNumber(it.unitPrice ?? it.price) ??
          (product ? product.price : 0);
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

    const created = await Order.findOne({
      where: applyOrderScopeWhere(
        { id: order.id },
        req,
        { allowClientProvidedScope: false, allowLegacyUserScope: true }
      ),
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
    const sort = toTrimOrNull(req.query?.sort);

    let where = {};

    if (q) {
      where[Op.or] = [
        { notes: { [Op.like]: `%${q}%` } },
        { code: { [Op.like]: `%${q}%` } },
      ];
    }
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    // 🔐 client => ses commandes uniquement
    if (req.user.role === 'client') {
      where.userId = req.user.id;
    } else if (userId) {
      // admin global uniquement
      where.userId = userId;
    }

    // ✅ application du scope multi-pays (model-aware)
    where = applyOrderScopeWhere(where, req, {
      allowClientProvidedScope: true,
      allowLegacyUserScope: true,
    });

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],

      // ✅ FIX MYSQL: utiliser la vraie colonne (created_at)
      order: buildOrderOrder(sort),

      limit,
      offset,
      distinct: true,
    });

    return res.json({
      orders: rows.map(withLabels),
      pagination: { page, limit, offset, total: count, count },
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

    const order = await Order.findOne({
      where: applyOrderScopeWhere(
        { id },
        req,
        { allowClientProvidedScope: false, allowLegacyUserScope: true }
      ),
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
        { model: OrderItem, as: 'items' },
      ],
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

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

    const order = await Order.findOne({
      where: applyOrderScopeWhere(
        { id },
        req,
        { allowClientProvidedScope: false, allowLegacyUserScope: true }
      ),
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'countryId', 'regionId'],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    if (!canWriteOrder(req.user, order)) {
      return res.status(403).json({ error: 'Accès interdit.' });
    }

    if (order.countryId == null || order.regionId == null) {
      const fallbackGeo = await inferGeoFromUserId(order.userId);
      if (order.countryId == null && fallbackGeo.countryId != null) {
        order.countryId = fallbackGeo.countryId;
      }
      if (order.regionId == null && fallbackGeo.regionId != null) {
        order.regionId = fallbackGeo.regionId;
      }
    }

    const norm = normalizeOrderPayload(req.body);

    if (norm.status) order.status = norm.status;
    if (norm.paymentStatus) order.paymentStatus = norm.paymentStatus;
    if (norm.paymentMethod) order.paymentMethod = norm.paymentMethod;
    if (norm.currency) order.currency = String(norm.currency).toUpperCase();
    if (norm.tax !== null) order.tax = toNullableNumber(norm.tax) ?? 0;
    if (norm.shipping !== null) order.shipping = toNullableNumber(norm.shipping) ?? 0;
    if (norm.note !== undefined) order.notes = toTrimOrNull(norm.note);

    // ✅ multi-pays : admin global uniquement (model-aware safe)
    if (isGlobalAdmin(req.user)) {
      const geoAssignments = filterGeoAssignmentsForModel(Order, {
        countryId:
          norm.countryId !== null && norm.countryId !== undefined
            ? toSafeInt(norm.countryId)
            : undefined,
        regionId:
          norm.regionId !== null && norm.regionId !== undefined
            ? toSafeInt(norm.regionId)
            : undefined,
      });

      if (geoAssignments.countryId !== undefined) order.countryId = geoAssignments.countryId;
      if (geoAssignments.regionId !== undefined) order.regionId = geoAssignments.regionId;
    }

    const { subtotal } = await recomputeTotals(order.id);
    const total =
      subtotal + parseFloat(order.tax || 0) + parseFloat(order.shipping || 0);

    order.subtotal = subtotal;
    order.total = total;

    syncPaymentStatus(order);
    await order.save();

    /* ============================================================
       💳 Création / MAJ automatique de transaction
       (logique EXISTANTE conservée)
    ============================================================ */
    if (['paid', 'delivered'].includes(order.status)) {
      try {
        const existingTx = await Transaction.findOne({
          where: {
            orderId: order.id,
            userId: order.userId,
            type: 'expense',
          },
        });

        if (!existingTx) {
          await Transaction.create(
            filterGeoAssignmentsForModel(Transaction, {
              userId: order.userId,
              orderId: order.id,
              type: 'expense',
              amount: order.total || 0,
              currency: order.currency || 'XOF',
              paymentMethod: order.paymentMethod || 'inconnu',
              description: `Paiement de la commande ${order.code || `#${order.id}`}`,
              status: 'completed',
              countryId: order.countryId ?? null,
              regionId: order.regionId ?? null,
            })
          );
        } else if (existingTx.status !== 'completed') {
          existingTx.status = 'completed';

          if (existingTx.countryId == null && order.countryId != null) {
            existingTx.countryId = order.countryId;
          }
          if (existingTx.regionId == null && order.regionId != null) {
            existingTx.regionId = order.regionId;
          }

          await existingTx.save();
        }
      } catch (err) {
        console.error('⚠️ Erreur transaction automatique commande:', err);
      }
    }

    const updated = await Order.findOne({
      where: applyOrderScopeWhere(
        { id: order.id },
        req,
        { allowClientProvidedScope: false, allowLegacyUserScope: true }
      ),
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
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

    const order = await Order.findOne({
      where: applyOrderScopeWhere(
        { id },
        req,
        { allowClientProvidedScope: false, allowLegacyUserScope: true }
      ),
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName', 'countryId', 'regionId'],
        },
        { model: OrderItem, as: 'items' },
      ],
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

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
