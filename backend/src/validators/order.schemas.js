'use strict';

const Joi = require('joi');

const orderItemSchema = Joi.object({
  productId: Joi.number().integer().allow(null),
  quantity: Joi.number().integer().min(1).allow(null),
  unitPrice: Joi.number().allow(null),
  price: Joi.number().allow(null),
  name: Joi.string().allow('', null),
});

const createOrderSchema = Joi.object({
  status: Joi.string().allow('', null),
  orderStatus: Joi.string().allow('', null),
  paymentStatus: Joi.string().allow('', null),
  paymentMethod: Joi.string().allow('', null),
  channel: Joi.string().allow('', null),
  currency: Joi.string().allow('', null),
  subtotal: Joi.number().allow(null),
  tax: Joi.number().allow(null),
  shipping: Joi.number().allow(null),
  discount: Joi.number().allow(null),
  total: Joi.number().allow(null),
  totalAmount: Joi.number().allow(null),
  customerNote: Joi.string().allow('', null),
  note: Joi.string().allow('', null),
  userId: Joi.number().integer().allow(null),
  items: Joi.array().items(orderItemSchema).allow(null),
  countryId: Joi.number().integer().allow(null),
  country_id: Joi.number().integer().allow(null),
  regionId: Joi.number().integer().allow(null),
  region_id: Joi.number().integer().allow(null),
});

const updateOrderSchema = Joi.object({
  status: Joi.string().allow('', null),
  orderStatus: Joi.string().allow('', null),
  paymentStatus: Joi.string().allow('', null),
  paymentMethod: Joi.string().allow('', null),
  channel: Joi.string().allow('', null),
  currency: Joi.string().allow('', null),
  subtotal: Joi.number().allow(null),
  tax: Joi.number().allow(null),
  shipping: Joi.number().allow(null),
  discount: Joi.number().allow(null),
  total: Joi.number().allow(null),
  totalAmount: Joi.number().allow(null),
  customerNote: Joi.string().allow('', null),
  note: Joi.string().allow('', null),
  userId: Joi.number().integer().allow(null),
  items: Joi.array().items(orderItemSchema).allow(null),
  countryId: Joi.number().integer().allow(null),
  country_id: Joi.number().integer().allow(null),
  regionId: Joi.number().integer().allow(null),
  region_id: Joi.number().integer().allow(null),
});

module.exports = {
  createOrderSchema,
  updateOrderSchema,
};
