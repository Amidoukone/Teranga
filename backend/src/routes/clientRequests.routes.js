'use strict';
const router = require('express').Router();
const Joi = require('joi');
const db = require('../../models');
const auth = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const { listClientRequests } = require('../services/clientRequests.service');
const querySchema = Joi.object({
  view: Joi.string().valid('active', 'review', 'history', 'all').default('active'),
  kind: Joi.string().valid('all', 'service', 'taxi', 'delivery', 'project', 'order').default('all'),
  q: Joi.string().trim().max(200).allow('').default(''),
  page: Joi.number().integer().min(1).max(100000).default(1), limit: Joi.number().integer().min(1).max(50).default(20),
});
router.get('/', auth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Cet espace est réservé aux demandes personnelles du client.' });
  const { value, error } = querySchema.validate(req.query);
  if (error) return res.status(400).json({ error: 'Filtres de demandes invalides' });
  try { return res.json(await listClientRequests(db, req.user, value)); }
  catch (failure) {
    logger.error({ err: failure }, 'client.requests.failed');
    return res.status(503).json({ error: 'Vos demandes sont indisponibles. Réessayez.', code: 'REQUESTS_UNAVAILABLE' });
  }
});
module.exports = router;
