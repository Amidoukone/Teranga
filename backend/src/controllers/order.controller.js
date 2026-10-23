'use strict';

const { Op, col } = require('sequelize');
const { Order, OrderItem, User, Product, sequelize, WorkCoordination } = require('../../models');

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
const {
  notifyOrderCreated,
  notifyOrderStatusUpdated,
  syncOrderPaymentTransaction,
} = require('../services/orderLifecycle.service');
const { resolveExecutionTerritory } = require('../services/executionTerritory.service');
const { normalizeCurrency } = require('../utils/currency');
const { canAccessGeoResource } = require('../utils/geoScope');
const { createTrackedResource } = require('../services/trackedCreation.service');
const logger = require('../utils/logger');

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
  const normalized = String(v).trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
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

    return out;
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
    status: body.orderStatus ?? body.status,
    paymentStatus: body.paymentStatus,
    paymentMethod: body.paymentMethod,
    channel: body.channel ?? 'web',
    currency: body.currency,
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
async function recomputeTotals(orderId, transaction) {
  const items = await OrderItem.findAll({ where: { orderId }, transaction });
  let subtotal = 0;

  for (const it of items) {
    const qty = Math.max(parseFloat(it.quantity || 0), 0);
    const price = Math.max(parseFloat(it.price || 0), 0);
    const line = qty * price;

    if (line !== it.total) {
      it.total = line;
      await it.save({ transaction });
    }
    subtotal += line;
  }

  return { subtotal };
}

/* ============================================================
   🔁 Synchronisation automatique statut ↔ paiement
============================================================ */
function syncPaymentStatus(order) {
  if (order.status === 'paid') {
    order.paymentStatus = 'paid';
  } else if (order.status === 'refunded') {
    order.paymentStatus = 'refunded';
  }
}

/* ============================================================
   1️⃣ CREATE — Crée une commande complète (+ gestion stock)
============================================================ */
exports.create = async (req, res) => {
  try {
    if (!canWriteOrder(req.user, null)) return res.status(403).json({ error: 'Accès interdit' });
    const norm = normalizeOrderPayload(req.body);
    const ownerId = req.user.role === 'admin' ? toSafeInt(norm.userId) || req.user.id : req.user.id;
    const effective = req.user.role === 'client' ? { countryId: toSafeInt(norm.countryId), regionId: toSafeInt(norm.regionId) } : getEffectiveScopeForCreate(req, norm);
    const fallback = await inferGeoFromUserId(ownerId);
    const countryId = effective.countryId ?? fallback.countryId;
    const regionId = effective.regionId ?? (String(countryId) === String(fallback.countryId) ? fallback.regionId : null);
    const territory = await resolveExecutionTerritory(countryId, regionId);
    if (territory.error) return res.status(400).json({ error: territory.error });
    if (req.user.role !== 'client' && !canAccessGeoResource(territory, req.user)) return res.status(403).json({ error: 'Commande hors de votre périmètre' });
    const currency = normalizeCurrency(norm.currency, territory.country?.currency || 'XOF');
    const order = await sequelize.transaction(async (transaction) => {
      const items = Array.isArray(norm.items) ? norm.items : [];
      const quantities = new Map();
      for (const item of items) {
        const id = toSafeInt(item.productId);
        if (id) quantities.set(id, (quantities.get(id) || 0) + (toSafeInt(item.quantity) || 1));
      }
      const products = quantities.size ? await Product.findAll({ where: { id: [...quantities.keys()] }, order: [['id', 'ASC']], transaction, lock: true }) : [];
      const byId = new Map(products.map((product) => [Number(product.id), product]));
      for (const [id, quantity] of quantities) {
        const product = byId.get(id);
        if (!product) throw Object.assign(new Error('Produit introuvable'), { status: 400 });
        if (product.isActive === false || product.isActive === 0) throw Object.assign(new Error('Produit indisponible'), { status: 400 });
        if ((product.countryId && String(product.countryId) !== String(territory.countryId)) || (product.regionId && String(product.regionId) !== String(territory.regionId))) throw Object.assign(new Error('Produit hors du territoire de la commande'), { status: 403 });
        if (product.currency && String(product.currency).toUpperCase() !== currency) throw Object.assign(new Error('Les produits et la commande doivent utiliser la même devise'), { status: 400 });
        if (product.stock != null && Number(product.stock) < quantity) throw Object.assign(new Error(`Stock insuffisant pour le produit ${product.name}`), { status: 400 });
      }
      const created = await createTrackedResource(req, Order, filterGeoAssignmentsForModel(Order, {
        userId: ownerId, status: req.user.role === 'admin' ? norm.status || 'created' : 'created',
        paymentStatus: req.user.role === 'admin' ? norm.paymentStatus || 'unpaid' : 'unpaid', paymentMethod: norm.paymentMethod || 'other',
        currency, subtotal: 0, tax: req.user.role === 'admin' ? toNullableNumber(norm.tax) || 0 : 0,
        shipping: req.user.role === 'admin' ? toNullableNumber(norm.shipping) || 0 : 0, total: 0,
        notes: toTrimOrNull(norm.note), countryId: territory.countryId, regionId: territory.regionId,
      }), { transaction });
      for (const item of items) {
        const product = byId.get(toSafeInt(item.productId));
        const quantity = toSafeInt(item.quantity) || 1;
        const price = req.user.role !== 'admin' && product ? Number(product.price || 0) : toNullableNumber(item.unitPrice ?? item.price) ?? Number(product?.price || 0);
        if (price < 0 || quantity < 1) throw Object.assign(new Error('Prix ou quantité invalide'), { status: 400 });
        await OrderItem.create({ orderId: created.id, productId: product?.id || null, name: product?.name || item.name || '—', sku: product?.sku || null, price, quantity, total: price * quantity }, { transaction });
      }
      for (const [id, quantity] of quantities) {
        const product = byId.get(id);
        if (product.stock != null) await product.update({ stock: Number(product.stock) - quantity }, { transaction });
      }
      const { subtotal } = await recomputeTotals(created.id, transaction);
      created.subtotal = subtotal;
      syncPaymentStatus(created);
      await created.save({ transaction });
      return created;
    });
    const created = await Order.findByPk(order.id, { include: [
      { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName'] }, { model: OrderItem, as: 'items' },
    ] });
    await notifyOrderCreated({ actorId: req.user.id, order });
    return res.status(201).json({ order: withLabels(created) });
  } catch (error) {
    logger.error({ err: error }, 'order.create.failed');
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Erreur lors de la création de la commande.' });
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
    logger.error({ err: e }, 'order.list.failed');
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

    const coordination = WorkCoordination ? await WorkCoordination.findOne({ where: { entityType: 'order', entityId: order.id } }) : null;
    return res.json({ order: { ...withLabels(order), coordination } });
  } catch (e) {
    logger.error({ err: e }, 'order.detail.failed');
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
      if (order.regionId == null && fallbackGeo.regionId != null && String(order.countryId) === String(fallbackGeo.countryId)) {
        order.regionId = fallbackGeo.regionId;
      }
    }

    const norm = normalizeOrderPayload(req.body);
    if (req.user.role === 'client') {
      const protectedFields = ['status', 'orderStatus', 'paymentStatus', 'currency', 'tax', 'shipping', 'countryId', 'country_id', 'regionId', 'region_id'];
      if (protectedFields.some((field) => req.body[field] !== undefined)) return res.status(403).json({ error: 'Les statuts, montants et le territoire sont gérés par le responsable de la commande.' });
    }
    const nextCountryId = norm.countryId ?? order.countryId;
    const nextRegionId = norm.regionId ?? (String(nextCountryId) === String(order.countryId) ? order.regionId : null);
    const moving = String(nextCountryId) !== String(order.countryId) || String(nextRegionId) !== String(order.regionId);
    const currencyChanging = norm.currency && String(norm.currency).toUpperCase() !== order.currency;
    if (moving || currencyChanging) {
      const db = require('../../models');
      const history = await Promise.all([
        OrderItem.count({ where: { orderId: id } }), db.Transaction.count({ where: { orderId: id } }), db.Evidence.count({ where: { orderId: id } }),
      ]);
      if (order.status !== 'created' || history.some(Boolean)) return res.status(409).json({ error: 'Le territoire et la devise sont figés après la création des éléments de commande.' });
      const territory = await resolveExecutionTerritory(nextCountryId, nextRegionId);
      if (territory.error) return res.status(400).json({ error: territory.error });
      if (!canAccessGeoResource(territory, req.user)) return res.status(403).json({ error: 'Territoire hors de votre périmètre' });
      if (moving && !isGlobalAdmin(req.user)) return res.status(403).json({ error: 'Le déplacement d’une commande exige un administrateur global' });
      order.countryId = territory.countryId; order.regionId = territory.regionId;
      if (moving && !norm.currency) order.currency = normalizeCurrency(null, territory.country?.currency || order.currency);
    }

    const coordination = WorkCoordination ? await WorkCoordination.findOne({ where: { entityType: 'order', entityId: order.id } }) : null;
    if (coordination && norm.status === 'paid') {
      norm.status = undefined; norm.paymentStatus = 'paid';
    }
    if (coordination && norm.status && norm.status !== order.status && norm.status !== 'cancelled') return res.status(409).json({ error: 'Utilisez le suivi opérationnel de la commande pour vérifier son avancement et ses justificatifs.' });
    if (norm.status) order.status = norm.status;
    if (norm.paymentStatus) order.paymentStatus = norm.paymentStatus;
    if (norm.paymentMethod) order.paymentMethod = norm.paymentMethod;
    if (norm.currency) order.currency = String(norm.currency).toUpperCase();
    if (norm.tax !== null) order.tax = toNullableNumber(norm.tax) ?? 0;
    if (norm.shipping !== null) order.shipping = toNullableNumber(norm.shipping) ?? 0;
    if (req.body.note !== undefined || req.body.customerNote !== undefined) order.notes = toTrimOrNull(norm.note);

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
    await sequelize.transaction(async (transaction) => {
      await Order.findByPk(order.id, { attributes: ['id'], transaction, lock: true });
      await order.save({ transaction });
      await syncOrderPaymentTransaction({ order, transaction });
    });
    await notifyOrderStatusUpdated({ actorId: req.user.id, order });

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
    logger.error({ err: e }, 'order.update.failed');
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

    if (!isGlobalAdmin(req.user)) {
      return res
        .status(403)
        .json({ error: 'Action réservée à un administrateur global.' });
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
    logger.error({ err: e }, 'order.remove.failed');
    return res
      .status(500)
      .json({ error: 'Erreur lors de la suppression de la commande.' });
  }
};
