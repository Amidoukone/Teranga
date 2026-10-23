'use strict';

const db = require('../../models');
const { canAccessGeoResource } = require('../utils/geoScope');
const { invalidateNotificationSummary } = require('./notification.service');

function minutes(value, fallback, minimum = 1) {
  return Number.isInteger(Number(value)) && Number(value) >= minimum && Number(value) <= 1440 ? Number(value) : fallback;
}

async function raiseEscalation(operation, reason, observedStatus, transaction, now) {
  const policy = operation.policy || {};
  await operation.update({ state: 'escalated', reason, observedStatus,
    policy: { ...policy, supervision: { raisedAt: now.toISOString(), reminderCount: 0 } },
    nextActionAt: new Date(now.getTime() + minutes(policy.escalationMinutes, 15) * 60000),
  }, { transaction });
}

async function remindEscalation(operation, resource, entityType, transaction, now) {
  if (operation.nextActionAt && new Date(operation.nextActionAt) > now) return;
  const admins = await db.User.findAll({ where: { role: 'admin' }, transaction });
  const candidates = admins.filter((admin) => canAccessGeoResource(resource, admin, { strictRegionScope: true }));
  candidates.sort((a, b) => Number(String(b.id) === String(operation.ownerUserId)) - Number(String(a.id) === String(operation.ownerUserId)) || Number(Boolean(b.countryId)) - Number(Boolean(a.countryId)) || a.id - b.id);
  const globalBackup = candidates.find((admin) => !admin.countryId && !admin.regionId);
  const recipients = [...new Set([...candidates.slice(0, 19).map((admin) => admin.id), ...(globalBackup ? [globalBackup.id] : [])])];
  const policy = operation.policy || {};
  const previous = policy.supervision || {};
  const count = Math.min(1000000, (Number(previous.reminderCount) || 0) + 1);
  const delay = minutes(policy.reminderMinutes, 60, 5);
  await operation.update({ policy: { ...policy, supervision: { ...previous, raisedAt: previous.raisedAt || operation.updatedAt?.toISOString() || now.toISOString(), reminderCount: count, lastReminderAt: now.toISOString(), recipientIds: recipients } },
    nextActionAt: new Date(now.getTime() + delay * 60000),
  }, { transaction });
  if (!recipients.length) return;
  const fields = { actorId: null, entityType, entityId: resource.id, action: 'status_updated',
    title: 'Relance de supervision', message: `La demande #${resource.id} attend une intervention : ${operation.reason}. Consultez le centre des opérations.`,
    entityStatus: resource.status, progress: 'in_progress', countryId: resource.countryId, regionId: resource.regionId,
    metadata: { [`${entityType}Id`]: resource.id, coordinationState: 'escalated', reminderCount: count } };
  await db.Notification.bulkCreate(recipients.map((userId) => ({ ...fields, userId, status: 'unread' })), { transaction });
  await db.Activity.bulkCreate(recipients.map((userId) => ({ ...fields, userId })), { transaction });
  transaction.afterCommit(() => invalidateNotificationSummary(recipients));
}

module.exports = { raiseEscalation, remindEscalation };
