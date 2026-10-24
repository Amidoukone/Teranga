'use strict';
const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/authorization.middleware');
const { PERMISSIONS } = require('../constants/permissions');
const { validateBody } = require('../middleware/validate.middleware');
const { updateCoordinationSchema, updateWorkCoordinationSchema } = require('../validators/coordination.schemas');
const controller = require('../controllers/operations.controller');
const Joi = require('joi');
const updates = require('../controllers/operationUpdates.controller');
const { writeLimiter } = require('../middleware/rateLimit.middleware');
router.use(auth);
const workspace = require('../controllers/workspaceQueue.controller');
const workspaceQuery = Joi.object({
  view: Joi.string().valid('action', 'following').default('action'),
  page: Joi.number().integer().min(1).max(100000).default(1), limit: Joi.number().integer().min(1).max(50).default(20),
  kind: Joi.string().valid('all', 'service', 'project', 'order', 'task').default('all'), q: Joi.string().trim().max(100).allow('').default(''),
  countryId: Joi.number().integer().positive(), regionId: Joi.number().integer().positive(),
});
router.get('/workspace', (req, res, next) => {
  const { value, error } = workspaceQuery.validate(req.query);
  if (error) return res.status(400).json({ error: 'Filtres de travail invalides' });
  req.workspaceQuery = value; next();
}, workspace.list);
// Suivi personnel : toujours limité au destinataire connecté, pour tous les rôles.
const updatesQuery = Joi.object({
  page: Joi.number().integer().min(1).max(100000).default(1), limit: Joi.number().integer().min(1).max(50).default(15),
  status: Joi.string().valid('all', 'read', 'unread').default('all'),
  progress: Joi.string().valid('new', 'in_progress', 'done'),
  entityType: Joi.string().valid('service', 'project', 'order', 'task', 'evidence', 'user'),
  action: Joi.string().max(60), from: Joi.date().iso(), to: Joi.date().iso(),
}).custom((value, helpers) => value.from && value.to && value.from > value.to ? helpers.error('any.invalid') : value);
router.get('/updates', (req, res, next) => {
  const { value, error } = updatesQuery.validate(req.query);
  if (error) return res.status(400).json({ error: 'Filtres de suivi invalides' });
  req.operationUpdatesQuery = value; next();
}, updates.list);
router.delete('/updates/cleanup', writeLimiter, updates.cleanup);
router.delete('/updates/:source/:id', writeLimiter, (req, res, next) => {
  if (!['notification', 'activity'].includes(req.params.source) || !/^[1-9][0-9]*$/.test(req.params.id)) return res.status(400).json({ error: 'Information invalide' });
  next();
}, validateBody(Joi.object({ version: Joi.string().hex().length(64).required() })), updates.remove);
router.get('/agent/capacity', controller.capacity);
router.patch('/agent/capacity', validateBody(Joi.object({ available: Joi.boolean(), maxConcurrent: Joi.number().integer().min(1).max(10), availableMinutes: Joi.number().integer().min(15).max(480) }).with('availableMinutes', 'available').min(1)), controller.capacity);
router.get('/agent/assignments', controller.mine);
router.get('/work/:type/:id', controller.detailWork);
router.post('/work/:type/:id/status', validateBody(Joi.object({ status: Joi.string().valid('in_progress', 'completed', 'validated', 'processing', 'shipped', 'delivered').required(), summary: Joi.string().max(4000).allow('') })), controller.advance);
router.use(requirePermission(PERMISSIONS.MISSION_OPERATE));
router.get('/', controller.list);
router.get('/readiness', controller.readiness);
router.patch('/work/:type/:id', validateBody(updateWorkCoordinationSchema), controller.updateWork);
router.patch('/:id', validateBody(updateCoordinationSchema), controller.update);
module.exports = router;
