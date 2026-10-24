'use strict';
const db = require('../../models');
const { listWorkspace } = require('../services/workspaceQueue.service');
const logger = require('../utils/logger');

exports.list = async (req, res) => {
  if (!['client', 'agent', 'admin', 'provider'].includes(req.user.role)) return res.status(403).json({ error: 'Cet espace de travail n’est pas disponible pour ce rôle.' });
  res.set('Cache-Control', 'no-store');
  try { return res.json(await listWorkspace(db, req.user, req.workspaceQuery)); }
  catch (error) {
    logger.error({ err: error }, 'workspace.queue.failed');
    return res.status(503).json({ error: 'La file de travail est indisponible. Consultez vos informations ou réessayez.', code: 'WORKSPACE_UNAVAILABLE' });
  }
};
