// frontend/src/services/orders.js

import api from './api';
import {
  applyLabels,
  canonicalizeOrderStatus,
  canonicalizePaymentStatus,
} from '../utils/labels';
import { mergeGeoParams, mergeGeoPayload } from './geo';

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

  // Harmonisation des noms acceptés par le backend
  const orderStatus = p.orderStatus ?? p.status;
  const paymentStatus = p.paymentStatus;

  // Canonicalisation ENUM
  if (orderStatus !== undefined)
    p.status = canonicalizeOrderStatus(orderStatus);

  if (paymentStatus !== undefined)
    p.paymentStatus = canonicalizePaymentStatus(paymentStatus);

  // Casting numériques
  if ('subtotal' in p) p.subtotal = toNumberOr(p.subtotal, undefined);
  if ('tax' in p) p.tax = toNumberOr(p.tax, undefined);
  if ('shipping' in p) p.shipping = toNumberOr(p.shipping, undefined);
  if ('discount' in p) p.discount = toNumberOr(p.discount, undefined);
  if ('total' in p) p.total = toNumberOr(p.total, undefined);
  if ('totalAmount' in p)
    p.total = toNumberOr(p.totalAmount, undefined);

  // Normalisation note
  if ('customerNote' in p && !('note' in p)) {
    p.note = p.customerNote;
  }

  // Currency
  if (typeof p.currency === 'string') {
    p.currency = p.currency.toUpperCase();
  }

  return stripUndefined(p);
}

/**
 * Harmonise le payload d'un item
 */
function prepareOrderItemPayload(raw = {}) {
  const b = { ...raw };
  if (b.productId !== undefined)
    b.productId = toNumberOr(b.productId, undefined);
  if (b.quantity !== undefined)
    b.quantity = toNumberOr(b.quantity, undefined);
  if (b.unitPrice !== undefined)
    b.unitPrice = toNumberOr(b.unitPrice, undefined);
  return stripUndefined(b);
}

/* -----------------------------------------------------------
 * Normalisation Order & OrderItem (API → UI)
 * --------------------------------------------------------- */
function normalizeOrderItem(raw = {}) {
  const item = { ...raw };

  if (item.unitPrice === undefined && isNumberLike(item.price)) {
    item.unitPrice = Number(item.price);
  }

  if (item.quantity !== undefined) item.quantity = Number(item.quantity);
  if (item.unitPrice !== undefined) item.unitPrice = Number(item.unitPrice);

  return applyLabels(item);
}

function normalizeOrder(raw = {}) {
  const o = { ...raw };

  if (o.totalAmount !== undefined && o.totalAmount !== null) {
    const n = Number(o.totalAmount);
    if (!Number.isNaN(n)) o.totalAmount = n;
  } else if (o.total !== undefined && o.total !== null) {
    const n = Number(o.total);
    if (!Number.isNaN(n)) o.totalAmount = n;
  }

  o.items = Array.isArray(o.items)
    ? o.items.map(normalizeOrderItem)
    : [];

  return applyLabels(o);
}

/* -----------------------------------------------------------
 * GET /orders
 * --------------------------------------------------------- */
export async function getOrders(params = {}) {
  const query = { ...params };

  if (query.status)
    query.status = canonicalizeOrderStatus(query.status);

  if (query.payment || query.paymentStatus) {
    const p = query.payment ?? query.paymentStatus;
    delete query.payment;
    query.paymentStatus = canonicalizePaymentStatus(p);
  }

  if ('page' in query) query.page = toIntOr(query.page, undefined);
  if ('limit' in query) query.limit = toIntOr(query.limit, undefined);
  if ('userId' in query) query.userId = toIntOr(query.userId, undefined);

  const { data } = await api.get('/orders', {
    params: stripUndefined(mergeGeoParams(query)),
  });

  const items = data?.items || data?.orders || [];
  return items.map(normalizeOrder);
}

/* -----------------------------------------------------------
 * GET /orders/:id
 * --------------------------------------------------------- */
export async function getOrderById(id) {
  const { data } = await api.get(`/orders/${id}`);
  const order = data?.order ?? data;
  return normalizeOrder(order);
}

/* -----------------------------------------------------------
 * POST /orders
 * --------------------------------------------------------- */
export async function createOrder(payload) {
  const body = prepareOrderPayload(mergeGeoPayload(payload));
  const { data } = await api.post('/orders', body);
  const order = data?.order ?? data;
  return normalizeOrder(order);
}

/* -----------------------------------------------------------
 * PUT /orders/:id
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
 * POST /orders/:id/items
 * --------------------------------------------------------- */
export async function addOrderItem(orderId, payload) {
  const body = prepareOrderItemPayload(payload);
  const { data } = await api.post(`/orders/${orderId}/items`, body);
  const item = data?.item ?? data;
  return normalizeOrderItem(item);
}

/* -----------------------------------------------------------
 * PUT /orders/:id/items/:itemId
 * --------------------------------------------------------- */
export async function updateOrderItem(orderId, itemId, payload) {
  const body = prepareOrderItemPayload(payload);
  const { data } = await api.put(
    `/orders/${orderId}/items/${itemId}`,
    body
  );
  const item = data?.item ?? data;
  return normalizeOrderItem(item);
}

/* -----------------------------------------------------------
 * DELETE /orders/:id/items/:itemId
 * --------------------------------------------------------- */
export async function deleteOrderItem(orderId, itemId) {
  const { data } = await api.delete(
    `/orders/${orderId}/items/${itemId}`
  );
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
