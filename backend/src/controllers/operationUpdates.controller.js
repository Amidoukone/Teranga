'use strict';
const { Op } = require('sequelize');
const db = require('../../models');
const { listOperationUpdates, findOperationUpdate, updateVersion } = require('../services/operationUpdates.service');
const { invalidateNotificationSummary } = require('../services/notification.service');
const logger = require('../utils/logger');

function fail(error, res) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  logger.error({ err: error }, 'operations.updates.failed');
  return res.status(500).json({ error: 'Impossible de charger ou modifier votre suivi' });
}

exports.list = async (req, res) => {
  try { return res.json(await listOperationUpdates(db, req.user.id, req.operationUpdatesQuery)); }
  catch (error) { return fail(error, res); }
};

exports.remove = async (req, res) => {
  try {
    await db.sequelize.transaction(async (transaction) => {
      const Model = req.params.source === 'notification' ? db.Notification : db.Activity;
      const record = await Model.findOne({ where: { id: req.params.id, userId: req.user.id }, transaction, lock: true });
      if (!record) throw Object.assign(new Error('Information introuvable'), { status: 404 });
      if (updateVersion({ ...record.toJSON(), source: req.params.source }) !== req.body.version) throw Object.assign(new Error('Cette information a changé. Actualisez le suivi avant de la retirer.'), { status: 409 });
      const item = await findOperationUpdate(db, req.user.id, req.params.source, req.params.id, transaction);
      if (!item) throw Object.assign(new Error('Cette information a changé. Actualisez le suivi.'), { status: 409 });
      if (item.notificationId) await db.Notification.destroy({ where: { id: item.notificationId, userId: req.user.id }, transaction });
      if (item.activityId) await db.Activity.destroy({ where: { id: item.activityId, userId: req.user.id }, transaction });
    });
    invalidateNotificationSummary(req.user.id);
    return res.json({ deleted: true });
  } catch (error) { return fail(error, res); }
};

exports.cleanup = async (req, res) => {
  try {
    const before = new Date(Date.now() - 30 * 86400000);
    const deleted = await db.sequelize.transaction(async (transaction) => {
      const notices = await db.Notification.destroy({ where: { userId: req.user.id, status: 'read', updatedAt: { [Op.lt]: before },
        [Op.or]: [{ readAt: null }, { readAt: { [Op.lt]: before } }] }, transaction });
      // Les copies liées aux informations encore non lues sont conservées.
      const [result] = await db.sequelize.query(`DELETE a FROM activities a WHERE a.userId = :userId AND a.createdAt < :before
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.userId = a.userId AND (n.status = 'unread' OR n.updatedAt >= :before OR n.readAt >= :before)
          AND n.entityType = a.entityType AND n.entityId <=> a.entityId)`, { replacements: { userId: req.user.id, before }, transaction, logging: false });
      return notices + Number(result.affectedRows || 0);
    });
    return res.json({ deleted });
  } catch (error) { return fail(error, res); }
};
