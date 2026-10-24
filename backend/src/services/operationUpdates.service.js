'use strict';
const { QueryTypes } = require('sequelize');
const crypto = require('crypto');

// Une notification est l'état courant d'une information ; l'activité en garde
// les étapes. Remplacer uniquement sa dernière copie conserve les étapes répétées.
// Les anciens parcours de changement de statut gardent parfois l'auteur initial
// dans la notification. Son identité ne doit pas dupliquer l'étape courante.
const sameEvent = (activity, notice) => ['userId', 'entityType', 'entityId', 'action', 'entityStatus', 'title', 'message', 'countryId', 'regionId']
  .map((field) => `${activity}.${field} <=> ${notice}.${field}`).join(' AND ');
const matchingActivity = (notice) => `(SELECT MAX(m.id) FROM activities m WHERE ${sameEvent('m', notice)} AND m.createdAt <= ${notice}.updatedAt)`;

const FEED_SQL = `
  SELECT 'notification' AS source, n.id, n.id AS notificationId, a.id AS activityId,
    n.actorId, n.entityType, n.entityId, n.action, n.title, n.message, n.progress,
    n.entityStatus, n.status, n.countryId, n.regionId, CAST(n.metadata AS CHAR) AS metadata,
    n.updatedAt AS revisionAt,
    COALESCE(a.createdAt, n.updatedAt) AS occurredAt
  FROM notifications n LEFT JOIN activities a ON a.id = ${matchingActivity('n')}
  WHERE n.userId = :userId
  UNION ALL
  SELECT 'activity' AS source, a.id, NULL AS notificationId, a.id AS activityId,
    a.actorId, a.entityType, a.entityId, a.action, a.title, a.message, a.progress,
    a.entityStatus, 'read' AS status, a.countryId, a.regionId, CAST(a.metadata AS CHAR) AS metadata,
    a.updatedAt AS revisionAt, a.createdAt AS occurredAt
  FROM activities a WHERE a.userId = :userId AND NOT EXISTS (
    SELECT 1 FROM notifications n WHERE ${sameEvent('a', 'n')} AND a.id = ${matchingActivity('n')}
  )`;

function decodeMetadata(value) {
  if (typeof value !== 'string') return value || null;
  try { return JSON.parse(value); } catch (_error) { return null; }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function updateVersion(row) {
  // DATETIME peut n'avoir qu'une précision d'une seconde. L'empreinte protège
  // aussi deux étapes différentes enregistrées pendant cette même seconde.
  const fields = ['id', 'actorId', 'entityType', 'entityId', 'action', 'title', 'message', 'progress', 'entityStatus', 'countryId', 'regionId'];
  const snapshot = [row.source, ...fields.map((field) => row[field] == null ? null : String(row[field])), row.status || 'read',
    canonical(decodeMetadata(row.metadata)), new Date(row.revisionAt || row.updatedAt).toISOString()];
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

async function readOperationNotice(db, userId, id, version) {
  return db.sequelize.transaction(async (transaction) => {
    const notice = await db.Notification.findOne({ where: { id, userId }, transaction, lock: true });
    if (!notice) throw Object.assign(new Error('Information introuvable'), { status: 404 });
    if (notice.status !== 'read') {
      if (updateVersion({ ...notice.toJSON(), source: 'notification' }) !== version) throw Object.assign(new Error('Une information plus récente est arrivée. Elle reste à lire.'), { status: 409 });
      // La lecture a sa propre date ; elle ne déplace pas l'événement dans le suivi.
      await notice.update({ status: 'read', readAt: new Date() }, { transaction, silent: true });
    }
    return notice;
  });
}

async function listOperationUpdates(db, userId, { page = 1, limit = 15, status = 'all', entityType, progress, action, from, to } = {}) {
  const filters = [];
  const replacements = { userId, limit, offset: (page - 1) * limit };
  for (const [field, value] of Object.entries({ status: status === 'all' ? null : status, entityType, progress, action })) {
    if (value) { filters.push(`u.${field} = :${field}`); replacements[field] = value; }
  }
  if (from) { filters.push('u.occurredAt >= :from'); replacements.from = new Date(from); }
  if (to) { filters.push('u.occurredAt <= :to'); replacements.to = new Date(to); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  return db.sequelize.transaction({ readOnly: true }, async (transaction) => {
    const options = { replacements, type: QueryTypes.SELECT, transaction, logging: false };
    const [count] = await db.sequelize.query(`SELECT COUNT(*) AS total FROM (${FEED_SQL}) u ${where}`, options);
    const items = await db.sequelize.query(`SELECT u.*, actor.firstName AS actorFirstName, actor.lastName AS actorLastName
      FROM (${FEED_SQL}) u LEFT JOIN users actor ON actor.id = u.actorId ${where}
      ORDER BY u.occurredAt DESC, u.source ASC, u.id DESC LIMIT :limit OFFSET :offset`, options);
    const unread = await db.Notification.count({ where: { userId, status: 'unread' }, transaction });
    return { items: items.map(({ actorFirstName, actorLastName, ...item }) => ({ ...item,
      key: `${item.source}:${item.id}`, version: updateVersion(item), metadata: decodeMetadata(item.metadata),
      actor: item.actorId ? { id: item.actorId, firstName: actorFirstName, lastName: actorLastName } : null,
    })), pagination: { page, limit, total: Number(count.total) }, summary: { unread } };
  });
}

async function findOperationUpdate(db, userId, source, id, transaction) {
  const rows = await db.sequelize.query(`SELECT u.* FROM (${FEED_SQL}) u WHERE u.source = :source AND u.id = :id`, {
    replacements: { userId, source, id }, type: QueryTypes.SELECT, transaction, logging: false,
  });
  return rows[0] || null;
}

module.exports = { listOperationUpdates, findOperationUpdate, updateVersion, readOperationNotice };
