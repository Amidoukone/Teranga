// frontend/src/services/orders.js

import api from './api';
import {
  applyLabels,
  canonicalizeOrderStatus,
  canonicalizePaymentStatus,
} from '../utils/labels';

/* -----------------------------------------------------------
 * Helpers locaux
 * --------------------------------------------------------- */
function isNumberLike(v) {
  return v !== undefined && v !== null && !Number.isNaN(Number(v));
}

function toNumberOr(v, fallback = undefined) {
  return isNumberLike(v) ? Number(v) : fallback;
}

function toIntOr(v, fallback = undefined) {
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function stripUndefined(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

/**
 * Harmonise le payload d'une commande avant envoi :
 * - canonicalise les statuts (order/payment)
 * - cast des nombres si fournis
 * - laisse les null (utile pour effacer notes), supprime les undefined
 */
function prepareOrderPayload(raw = {}) {
  const p = { ...raw };

  // Harmonisation des noms acceptés par le backend (qui supporte status | orderStatus, note | customerNote)
  const orderStatus = p.orderStatus ?? p.status;
  const paymentStatus = p.paymentStatus;

  // Canonicalisation pour coller aux ENUM MySQL
  if (orderStatus !== undefined) p.status = canonicalizeOrderStatus(orderStatus);
  if (paymentStatus !== undefined) p.paymentStatus = canonicalizePaymentStatus(paymentStatus);

  // Casting des numériques — on n'envoie que si fournis
  if ('subtotal' in p) p.subtotal = toNumberOr(p.subtotal, undefined);
  if ('tax' in p) p.tax = toNumberOr(p.tax, undefined);
  if ('shipping' in p) p.shipping = toNumberOr(p.shipping, undefined);
  if ('discount' in p) p.discount = toNumberOr(p.discount, undefined);
  if ('total' in p) p.total = toNumberOr(p.total, undefined);
  if ('totalAmount' in p) p.total = toNumberOr(p.totalAmount, undefined);

  // Normalisation note
  if ('customerNote' in p && !('note' in p)) {
    p.note = p.customerNote;
  }

  // Currency en UPPER si fourni
  if (typeof p.currency === 'string') {
    p.currency = p.currency.toUpperCase();
  }

  return stripUndefined(p);
}

/**
 * Harmonise le payload d'un item avant envoi :
 * - cast numériques (productId, quantity, unitPrice)
 * - laisse undefined si non fournis (le back applique ses défauts)
 */
function prepareOrderItemPayload(raw = {}) {
  const b = { ...raw };
  if (b.productId !== undefined) b.productId = toNumberOr(b.productId, undefined);
  if (b.quantity !== undefined) b.quantity = toNumberOr(b.quantity, undefined);
  if (b.unitPrice !== undefined) b.unitPrice = toNumberOr(b.unitPrice, undefined);
  return stripUndefined(b);
}

/* -----------------------------------------------------------
 * Normalisation Order & OrderItem (réponses API → UI)
 * --------------------------------------------------------- */
function normalizeOrderItem(raw = {}) {
  const item = { ...raw };

  // Compat rétro : si l’API renvoie "price", on le recopie en unitPrice pour la cohérence UI
  if (item.unitPrice === undefined && isNumberLike(item.price)) {
    item.unitPrice = Number(item.price);
  }
  if (item.quantity !== undefined) item.quantity = Number(item.quantity);
  if (item.unitPrice !== undefined) item.unitPrice = Number(item.unitPrice);

  return applyLabels(item);
}

function normalizeOrder(raw = {}) {
  const o = { ...raw };

  // totalAmount (alias front) → conserve une valeur numérique fiable
  if (o.totalAmount !== undefined && o.totalAmount !== null) {
    const n = Number(o.totalAmount);
    if (!Number.isNaN(n)) o.totalAmount = n;
  } else if (o.total !== undefined && o.total !== null) {
    const n = Number(o.total);
    if (!Number.isNaN(n)) o.totalAmount = n;
  }

  // Items labellisés & normalisés
  o.items = Array.isArray(o.items) ? o.items.map(normalizeOrderItem) : [];

  // Applique labels + harmonise orderStatus/paymentStatus (via applyLabels qui utilise les canonicalizers)
  return applyLabels(o);
}

/* -----------------------------------------------------------
 * GET /orders (liste)
 * Accepte params (q, status, paymentStatus, page, limit, sort, userId, etc.)
 * On canonicalise status/paymentStatus si fournis pour le back.
 * --------------------------------------------------------- */
export async function getOrders(params = {}) {
  const query = { ...params };

  // Canonicalisation des statuts si fournis
  if (query.status) query.status = canonicalizeOrderStatus(query.status);
  if (query.payment || query.paymentStatus) {
    // certains appels front utilisent "payment", on le mappe vers paymentStatus
    const p = query.payment ?? query.paymentStatus;
    delete query.payment;
    query.paymentStatus = canonicalizePaymentStatus(p);
  }

  // Sécurisation des paramètres numériques classiques (non-cassant)
  if ('page' in query) query.page = toIntOr(query.page, undefined);
  if ('limit' in query) query.limit = toIntOr(query.limit, undefined);
  if ('userId' in query) query.userId = toIntOr(query.userId, undefined);

  const { data } = await api.get('/orders', { params: stripUndefined(query) });
  const items = data?.items || data?.orders || [];
  return items.map(normalizeOrder);
}

/* -----------------------------------------------------------
 * GET /orders/:id (détail)
 * --------------------------------------------------------- */
export async function getOrderById(id) {
  const { data } = await api.get(`/orders/${id}`);
  const order = data?.order ?? data;
  return normalizeOrder(order);
}

/* -----------------------------------------------------------
 * POST /orders (création)
 * --------------------------------------------------------- */
export async function createOrder(payload) {
  const body = prepareOrderPayload(payload);
  const { data } = await api.post('/orders', body);
  const order = data?.order ?? data;
  return normalizeOrder(order);
}

/* -----------------------------------------------------------
 * PUT /orders/:id (mise à jour)
 * --------------------------------------------------------- */
export async function updateOrder(id, payload) {
  const body = prepareOrderPayload(payload);
  const { data } = await api.put(`/orders/${id}`, body);
  const order = data?.order ?? data;
  return normalizeOrder(order);
}

/* -----------------------------------------------------------
 * DELETE /orders/:id
 * --------------------------------------------------------- */
export async function deleteOrder(id) {
  const { data } = await api.delete(`/orders/${id}`);
  return data;
}

/* -----------------------------------------------------------
 * POST /orders/:id/items (ajout item)
 * --------------------------------------------------------- */
export async function addOrderItem(orderId, payload) {
  const body = prepareOrderItemPayload(payload);
  const { data } = await api.post(`/orders/${orderId}/items`, body);
  const item = data?.item ?? data;
  return normalizeOrderItem(item);
}

/* -----------------------------------------------------------
 * PUT /orders/:id/items/:itemId (maj item)
 * --------------------------------------------------------- */
export async function updateOrderItem(orderId, itemId, payload) {
  const body = prepareOrderItemPayload(payload);
  const { data } = await api.put(`/orders/${orderId}/items/${itemId}`, body);
  const item = data?.item ?? data;
  return normalizeOrderItem(item);
}

/* -----------------------------------------------------------
 * DELETE /orders/:id/items/:itemId
 * --------------------------------------------------------- */
export async function deleteOrderItem(orderId, itemId) {
  const { data } = await api.delete(`/orders/${orderId}/items/${itemId}`);
  return data;
}

/* -----------------------------------------------------------
 * Export groupé
 * --------------------------------------------------------- */
const OrdersService = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  addOrderItem,
  updateOrderItem,
  deleteOrderItem,
};

export default OrdersService;
