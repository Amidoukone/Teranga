'use strict';

const Joi = require('joi');

const createPropertyListingSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required(),
  type: Joi.string().valid('house', 'apartment', 'land').required(),
  transactionType: Joi.string().valid('rent', 'sale').required(),
  neighborhood: Joi.string().trim().max(120).allow('', null),
  city: Joi.string().trim().min(2).max(120).required(),
  // Optionnel ici : un master n'envoie jamais countryId/regionId (hérité de son propre scope
  // côté contrôleur, resolveWriteScope) — seul l'admin global le fournit. Le rendre required()
  // rejetait systématiquement la création pour un master avant même d'atteindre le contrôleur.
  countryId: Joi.number().integer().positive(),
  regionId: Joi.number().integer().positive().allow('', null),
  price: Joi.number().positive().required(),
  currency: Joi.string().trim().max(10),
  description: Joi.string().trim().max(3000).allow('', null),
});

const updatePropertyListingSchema = Joi.object({
  title: Joi.string().trim().min(3).max(150),
  type: Joi.string().valid('house', 'apartment', 'land'),
  transactionType: Joi.string().valid('rent', 'sale'),
  neighborhood: Joi.string().trim().max(120).allow('', null),
  city: Joi.string().trim().min(2).max(120),
  countryId: Joi.number().integer().positive(),
  regionId: Joi.number().integer().positive().allow('', null),
  price: Joi.number().positive(),
  currency: Joi.string().trim().max(10),
  description: Joi.string().trim().max(3000).allow('', null),
  status: Joi.string().valid('available', 'rented', 'sold'),
});

module.exports = {
  createPropertyListingSchema,
  updatePropertyListingSchema,
};
