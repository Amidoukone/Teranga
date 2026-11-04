'use strict';
const { QueryTypes, Transaction } = require('sequelize');
const { MISSION_HISTORY_STATUSES } = require('../constants/missionStatus');

// Filter and paginate the complete personal collection before returning a page.
// No geographic selection may hide a client's own cross-border requests.
function buildCollection(db) {
  const qg = db.sequelize.getQueryInterface().queryGenerator;
  const quote = name => qg.quoteIdentifier(name);
  const table = (Model, alias) => `${qg.quoteTable(Model.getTableName())} ${quote(alias)}`;
  const col = (Model, alias, name) => {
    const attr = Model.rawAttributes[name] || Model.rawAttributes[name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)];
    if (!attr) throw new Error(`Client requests column missing: ${Model.name}.${name}`);
    return `${quote(alias)}.${quote(attr.field || name)}`;
  };
  const s = name => col(db.Service, 's', name), p = name => col(db.Project, 'p', name), o = name => col(db.Order, 'o', name);
  const category = name => col(db.TradeCategory, 'category', name);
  const executor = alias => `NULLIF(TRIM(CONCAT_WS(' ', ${col(db.User, alias, 'firstName')}, ${col(db.User, alias, 'lastName')})), '')`;
  const terminal = MISSION_HISTORY_STATUSES.map(value => db.sequelize.escape(value)).join(',');
  const select = fields => Object.entries(fields).map(([name, value]) => `${value} AS ${quote(name)}`).join(',');
  const service = {
    kind: "'service'", id: s('id'), title: s('title'), description: s('description'), reference: 'NULL', status: s('status'), missionStatus: s('missionStatus'),
    slug: category('slug'), categoryName: category('name'), paymentStatus: 'NULL', createdAt: s('createdAt'),
    executor: `CASE WHEN ${s('executionType')} = 'provider' THEN ${col(db.Provider, 'provider', 'displayFirstName')} ELSE ${executor('agent')} END`,
    history: `CASE WHEN ${s('missionStatus')} IS NOT NULL THEN ${s('missionStatus')} IN (${terminal}) ELSE ${s('status')} = 'validated' END`,
    review: `CASE WHEN ${s('missionStatus')} IS NOT NULL THEN ${s('missionStatus')} = 'COMPLETED' ELSE ${s('status')} = 'completed' END`,
  };
  const work = (Model, alias, kind) => ({
    kind: `'${kind}'`, id: col(Model, alias, 'id'), title: kind === 'project' ? p('title') : o('code'), description: kind === 'project' ? p('description') : o('notes'),
    reference: kind === 'order' ? o('code') : 'NULL', status: col(Model, alias, 'status'), missionStatus: 'NULL', slug: 'NULL', categoryName: 'NULL',
    paymentStatus: kind === 'order' ? o('paymentStatus') : 'NULL', createdAt: col(Model, alias, 'createdAt'), executor: kind === 'project' ? executor('agent') : 'NULL',
    history: kind === 'project' ? `${p('status')} IN ('validated','cancelled')` : `${o('status')} IN ('fulfilled','delivered','cancelled','refunded')`,
    review: kind === 'project' ? `(${p('status')} = 'completed' AND ${col(db.WorkCoordination, 'coordination', 'id')} IS NOT NULL)` : '0',
  });
  return [
    `SELECT ${select(service)} FROM ${table(db.Service, 's')}
      LEFT JOIN ${table(db.TradeCategory, 'category')} ON ${category('id')} = ${s('tradeCategoryId')}
      LEFT JOIN ${table(db.Provider, 'provider')} ON ${col(db.Provider, 'provider', 'id')} = ${s('providerId')}
      LEFT JOIN ${table(db.User, 'agent')} ON ${col(db.User, 'agent', 'id')} = ${s('agentId')}
      WHERE ${s('clientId')} = :userId AND ${s('parentServiceId')} IS NULL`,
    `SELECT ${select(work(db.Project, 'p', 'project'))} FROM ${table(db.Project, 'p')}
      LEFT JOIN ${table(db.User, 'agent')} ON ${col(db.User, 'agent', 'id')} = ${p('agentId')}
      LEFT JOIN ${table(db.WorkCoordination, 'coordination')} ON ${col(db.WorkCoordination, 'coordination', 'entityType')} = 'project' AND ${col(db.WorkCoordination, 'coordination', 'entityId')} = ${p('id')}
      WHERE ${p('clientId')} = :userId`,
    `SELECT ${select(work(db.Order, 'o', 'order'))} FROM ${table(db.Order, 'o')} WHERE ${o('userId')} = :userId`,
  ].join('\nUNION ALL\n');
}

async function listClientRequests(db, actor, filters) {
  const collection = buildCollection(db);
  // Use ! as the LIKE escape character, including for literal %, _ and ! searches.
  const replacements = { userId: actor.id, q: `%${filters.q.replace(/[!%_]/g, '!$&')}%`,
    exactId: /^#?[1-9][0-9]*$/.test(filters.q) && Number.isSafeInteger(Number(filters.q.replace('#', ''))) ? Number(filters.q.replace('#', '')) : -1,
    kind: filters.kind, limit: filters.limit, offset: (filters.page - 1) * filters.limit };
  const conditions = [filters.view === 'history' ? 'history = 1' : filters.view === 'review' ? 'review = 1 AND history = 0' : filters.view === 'active' ? 'history = 0' : '1=1'];
  if (filters.kind === 'taxi' || filters.kind === 'delivery') { conditions.push('kind = \'service\' AND slug = :slug'); replacements.slug = filters.kind === 'taxi' ? 'mobilite' : 'livraison'; }
  else if (filters.kind === 'service') conditions.push("kind = 'service' AND (slug IS NULL OR slug NOT IN ('mobilite','livraison'))");
  else if (filters.kind !== 'all') conditions.push('kind = :kind');
  if (filters.q) conditions.push("(title LIKE :q ESCAPE '!' OR description LIKE :q ESCAPE '!' OR reference LIKE :q ESCAPE '!' OR id = :exactId)");
  const where = conditions.join(' AND ');
  return db.sequelize.transaction({ readOnly: true, isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
    const options = { replacements, type: QueryTypes.SELECT, transaction, logging: false };
    const [count] = await db.sequelize.query(`SELECT COUNT(*) AS total FROM (${collection}) requests WHERE ${where}`, options);
    const rows = await db.sequelize.query(`SELECT * FROM (${collection}) requests WHERE ${where} ORDER BY createdAt DESC, kind ASC, id DESC LIMIT :limit OFFSET :offset`, options);
    return { items: rows.map(({ description, slug, categoryName, executor, history, review, ...row }) => ({ ...row, id: Number(row.id), key: `${row.kind}:${row.id}`,
      history: Boolean(Number(history)), review: Boolean(Number(review)),
      ...(row.kind === 'order' && description ? { summary: description.slice(0, 240) } : {}),
      ...(row.kind === 'service' ? { tradeCategory: { slug, name: categoryName }, agent: executor ? { firstName: executor } : null } : { executor }),
    })), pagination: { page: filters.page, limit: filters.limit, total: Number(count.total) } };
  });
}
module.exports = { listClientRequests };
