'use strict';

const { QueryTypes, Op, Transaction } = require('sequelize');
const { getUserGeoScope, isGlobalAdmin } = require('../utils/geoScope');
const { resolveStrictRegionScope } = require('../utils/geoScopePolicy');
const { MISSION_HISTORY_STATUSES } = require('../constants/missionStatus');

// Les tables, colonnes, alias et codes d'action sont exclusivement internes.
// Les valeurs utilisateur sont toujours des paramètres de requête.
function buildQueue(db, actor, filters) {
  const qg = db.sequelize.getQueryInterface().queryGenerator;
  const quote = (value) => qg.quoteIdentifier(value);
  const table = (Model, alias) => `${qg.quoteTable(Model.getTableName())} ${quote(alias)}`;
  const col = (Model, alias, name) => {
    const attr = Model.rawAttributes[name] || Model.rawAttributes[name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
    if (!attr) throw new Error(`Workspace column missing: ${Model.name}.${name}`);
    return `${quote(alias)}.${quote(attr.field || name)}`;
  };
  const s = (name) => col(db.Service, 's', name);
  const p = (name) => col(db.Project, 'p', name);
  const o = (name) => col(db.Order, 'o', name);
  const t = (name) => col(db.Task, 't', name);
  const sc = (name) => col(db.MissionCoordination, 'sc', name);
  const wc = (name) => col(db.WorkCoordination, 'wc', name);
  const userName = (alias) => `NULLIF(TRIM(CONCAT_WS(' ', ${col(db.User, alias, 'firstName')}, ${col(db.User, alias, 'lastName')})), '')`;
  const { countryId, regionId } = getUserGeoScope(actor);
  const params = { userId: actor.id, actorCountry: countryId, actorRegion: regionId, selectedCountry: filters.countryId, selectedRegion: filters.regionId,
    q: `%${filters.q}%`, exactId: /^#?[1-9][0-9]*$/.test(filters.q) && Number.isSafeInteger(Number(filters.q.replace('#', ''))) ? Number(filters.q.replace('#', '')) : -1 };
  const geo = (Model, alias) => {
    if (isGlobalAdmin(actor)) return '1=1';
    const country = col(Model, alias, 'countryId'), region = col(Model, alias, 'regionId');
    if (regionId) {
      const regional = resolveStrictRegionScope() || !countryId ? `${region} = :actorRegion`
        : `(${region} = :actorRegion OR (${region} IS NULL AND ${country} = :actorCountry))`;
      return countryId ? `((${country} IS NULL OR ${country} = :actorCountry) AND ${regional})` : regional;
    }
    return countryId ? `${country} = :actorCountry` : '1=0';
  };
  const selected = (Model, alias) => [filters.countryId ? `${col(Model, alias, 'countryId')} = :selectedCountry` : '1=1',
    filters.regionId ? `${col(Model, alias, 'regionId')} = :selectedRegion` : '1=1'].join(' AND ');
  let serviceRead = '1=0', projectRead = '1=0', orderRead = '1=0', taskRead = '1=0';
  if (actor.role === 'client') {
    serviceRead = `${s('clientId')} = :userId AND ${s('parentServiceId')} IS NULL`;
    projectRead = `${p('clientId')} = :userId`; orderRead = `${o('userId')} = :userId`;
    taskRead = `(${t('creatorId')} = :userId OR ${s('clientId')} = :userId OR ${col(db.Property, 'property', 'ownerId')} = :userId)`;
  } else if (actor.role === 'agent') {
    serviceRead = `${s('agentId')} = :userId AND (${s('missionStatus')} IS NOT NULL OR (${geo(db.Service, 's')}))`;
    projectRead = `${p('agentId')} = :userId AND (${geo(db.Project, 'p')})`;
    // Le détail d'une commande reste accessible à l'agent affecté dans sa coordination.
    orderRead = `${wc('executorUserId')} = :userId AND (${geo(db.Order, 'o')})`;
    taskRead = `(${t('assignedTo')} = :userId OR ${s('agentId')} = :userId) AND (${geo(db.Task, 't')})`;
  } else if (actor.role === 'admin') {
    serviceRead = geo(db.Service, 's'); projectRead = geo(db.Project, 'p'); orderRead = geo(db.Order, 'o'); taskRead = geo(db.Task, 't');
  } else if (actor.role === 'provider') {
    serviceRead = `${s('executionType')} = 'provider' AND ${s('missionStatus')} IS NOT NULL AND ${col(db.Provider, 'provider', 'userId')} = :userId`;
  }
  const terminal = MISSION_HISTORY_STATUSES.map((value) => db.sequelize.escape(value)).join(',');
  const serviceOpen = `((${s('missionStatus')} IS NOT NULL AND ${s('missionStatus')} NOT IN (${terminal})) OR (${s('missionStatus')} IS NULL AND ${s('status')} IN ('created','in_progress','completed')))`;
  const projectOpen = `${p('status')} NOT IN ('validated','cancelled')`;
  const orderOpen = `${o('status')} NOT IN ('fulfilled','delivered','cancelled','refunded')`;
  const serviceFrom = `${table(db.Service, 's')}
    LEFT JOIN ${table(db.MissionCoordination, 'sc')} ON ${sc('serviceId')} = ${s('id')}
    LEFT JOIN ${table(db.Provider, 'provider')} ON ${col(db.Provider, 'provider', 'id')} = ${s('providerId')}
    LEFT JOIN ${table(db.TradeCategory, 'category')} ON ${col(db.TradeCategory, 'category', 'id')} = ${s('tradeCategoryId')}
    LEFT JOIN ${table(db.User, 'executor')} ON ${col(db.User, 'executor', 'id')} = ${s('agentId')}`;
  const workFrom = (Model, alias, type) => `${table(Model, alias)}
    LEFT JOIN ${table(db.WorkCoordination, 'wc')} ON ${wc('entityType')} = '${type}' AND ${wc('entityId')} = ${col(Model, alias, 'id')}
    LEFT JOIN ${table(db.User, 'executor')} ON ${col(db.User, 'executor', 'id')} = ${type === 'project' ? p('agentId') : wc('executorUserId')}`;
  const serviceDone = `COALESCE(${s('missionStatus')}, UPPER(${s('status')})) = 'COMPLETED'`;
  let serviceAction = 'NULL', projectAction = 'NULL', orderAction = 'NULL', taskAction = 'NULL';
  if (actor.role === 'client') {
    serviceAction = `CASE WHEN ${serviceDone} THEN 'result_review' END`;
    projectAction = `CASE WHEN ${p('status')} = 'completed' THEN 'result_review' END`;
  } else if (actor.role === 'agent' || actor.role === 'provider') {
    serviceAction = `CASE WHEN ${s('executionType')} = '${actor.role}' AND ((${s('missionStatus')} IN ('ASSIGNED','EN_ROUTE','ON_SITE','IN_PROGRESS')) OR (${s('missionStatus')} IS NULL AND ${s('status')} IN ('created','in_progress'))) THEN 'service_execute' END`;
    if (actor.role === 'agent') {
      projectAction = `CASE WHEN ${p('status')} IN ('created','in_progress') THEN 'project_execute' END`;
      orderAction = `CASE WHEN ${o('status')} IN ('created','paid','processing','shipped') THEN 'order_execute' END`;
      taskAction = `CASE WHEN ${t('assignedTo')} = :userId AND ${t('status')} = 'created' THEN 'step_start' WHEN ${t('assignedTo')} = :userId AND ${t('status')} = 'in_progress' THEN 'step_complete' END`;
    }
  } else if (actor.role === 'admin') {
    serviceAction = `CASE WHEN ${s('missionStatus')} = 'DISPUTED' THEN 'resolve' WHEN NOT (${serviceDone}) AND (${sc('state')} = 'escalated' OR ${sc('ownerUserId')} IS NULL OR (${s('status')} = 'created' AND ${s('agentId')} IS NULL AND ${s('providerId')} IS NULL)) THEN 'coordinate' END`;
    projectAction = `CASE WHEN ${p('status')} <> 'completed' AND (${wc('state')} = 'escalated' OR ${wc('ownerUserId')} IS NULL OR ${p('agentId')} IS NULL) THEN 'coordinate' END`;
    orderAction = `CASE WHEN ${wc('state')} = 'escalated' OR ${wc('ownerUserId')} IS NULL OR ${wc('executorUserId')} IS NULL THEN 'coordinate' END`;
    taskAction = `CASE WHEN ${t('status')} = 'completed' THEN 'step_review' WHEN ${t('status')} = 'created' AND ${t('assignedTo')} IS NULL THEN 'step_assign' END`;
  }
  const serviceFields = { kind: "'service'", id: s('id'), title: s('title'), status: s('status'), missionStatus: s('missionStatus'), executionType: s('executionType'),
    slug: col(db.TradeCategory, 'category', 'slug'), requestedVehicleType: s('requestedVehicleType'), countryId: s('countryId'), regionId: s('regionId'),
    executor: `CASE WHEN ${s('executionType')} = 'provider' THEN ${col(db.Provider, 'provider', 'displayFirstName')} ELSE ${userName('executor')} END`,
    createdAt: s('createdAt'), deadline: sc('nextActionAt'), escalated: `IF(${sc('state')} = 'escalated',1,0)`, actionCode: serviceAction, targetKind: "'service'", targetId: s('id'), stepSource: '0' };
  const workFields = (Model, alias, type, action) => ({ kind: `'${type}'`, id: col(Model, alias, 'id'), title: col(Model, alias, type === 'order' ? 'code' : 'title'), status: col(Model, alias, 'status'),
    missionStatus: 'NULL', executionType: 'NULL', slug: 'NULL', requestedVehicleType: 'NULL', countryId: col(Model, alias, 'countryId'), regionId: col(Model, alias, 'regionId'),
    executor: userName('executor'), createdAt: col(Model, alias, 'createdAt'), deadline: wc('nextActionAt'), escalated: `IF(${wc('state')} = 'escalated',1,0)`,
    actionCode: action, targetKind: `'${type}'`, targetId: col(Model, alias, 'id'), stepSource: '0' });
  const select = (fields) => `${Object.entries(fields).map(([name, value]) => `${value} AS ${quote(name)}`).join(',\n')},
    (${fields.title} LIKE :q OR ${fields.id} = :exactId ${fields.stepSource === '1' ? `OR ${t('title')} LIKE :q OR ${t('id')} = :exactId` : ''}) AS searchMatch`;
  const parentService = `(${s('id')} IS NOT NULL AND (${serviceRead}) AND (${selected(db.Service, 's')}))`;
  const parentProject = `(${p('id')} IS NOT NULL AND (${projectRead}) AND (${selected(db.Project, 'p')}))`;
  const choose = (service, project, task) => `CASE WHEN ${parentService} THEN ${service} WHEN ${parentProject} THEN ${project} ELSE ${task} END`;
  const taskFields = {
    kind: choose("'service'", "'project'", "'task'"), id: choose(s('id'), p('id'), t('id')),
    title: choose(s('title'), p('title'), t('title')), status: choose(s('status'), p('status'), t('status')),
    missionStatus: choose(s('missionStatus'), 'NULL', 'NULL'), executionType: choose(s('executionType'), 'NULL', 'NULL'), slug: choose(col(db.TradeCategory, 'category', 'slug'), 'NULL', 'NULL'),
    requestedVehicleType: choose(s('requestedVehicleType'), 'NULL', 'NULL'), countryId: choose(s('countryId'), p('countryId'), t('countryId')), regionId: choose(s('regionId'), p('regionId'), t('regionId')),
    executor: choose(serviceFields.executor, userName('projectExecutor'), userName('taskExecutor')), createdAt: choose(s('createdAt'), p('createdAt'), t('createdAt')),
    deadline: t('dueDate'), escalated: '0', actionCode: taskAction, targetKind: "'task'", targetId: t('id'), stepSource: '1',
  };
  const taskFrom = `${table(db.Task, 't')}
    LEFT JOIN ${table(db.Service, 's')} ON ${s('id')} = ${t('serviceId')}
    LEFT JOIN ${table(db.Project, 'p')} ON ${p('id')} = ${t('projectId')}
    LEFT JOIN ${table(db.Property, 'property')} ON ${col(db.Property, 'property', 'id')} = ${t('propertyId')}
    LEFT JOIN ${table(db.Provider, 'provider')} ON ${col(db.Provider, 'provider', 'id')} = ${s('providerId')}
    LEFT JOIN ${table(db.TradeCategory, 'category')} ON ${col(db.TradeCategory, 'category', 'id')} = ${s('tradeCategoryId')}
    LEFT JOIN ${table(db.User, 'executor')} ON ${col(db.User, 'executor', 'id')} = ${s('agentId')}
    LEFT JOIN ${table(db.User, 'projectExecutor')} ON ${col(db.User, 'projectExecutor', 'id')} = ${p('agentId')}
    LEFT JOIN ${table(db.User, 'taskExecutor')} ON ${col(db.User, 'taskExecutor', 'id')} = ${t('assignedTo')}`;
  const sources = [
    `SELECT ${select(serviceFields)} FROM ${serviceFrom} WHERE (${serviceRead}) AND ${serviceOpen} AND (${selected(db.Service, 's')})`,
    `SELECT ${select(workFields(db.Project, 'p', 'project', projectAction))} FROM ${workFrom(db.Project, 'p', 'project')} WHERE (${projectRead}) AND ${projectOpen} AND (${selected(db.Project, 'p')})`,
    `SELECT ${select(workFields(db.Order, 'o', 'order', orderAction))} FROM ${workFrom(db.Order, 'o', 'order')} WHERE (${orderRead}) AND ${orderOpen} AND (${selected(db.Order, 'o')})`,
  ];
  if (actor.role !== 'provider') sources.push(`SELECT ${select(taskFields)} FROM ${taskFrom} WHERE (${taskRead}) AND ${t('status')} NOT IN ('validated','cancelled') AND (${selected(db.Task, 't')})`);
  const priority = `CASE WHEN actionCode = 'resolve' THEN 0 WHEN escalated = 1 THEN 1 WHEN actionCode IN ('result_review','step_review') THEN 2 WHEN actionCode IN ('step_start','step_complete') THEN 3 WHEN actionCode = 'step_assign' THEN 4 ELSE 5 END`;
  const token = `CASE WHEN actionCode IS NOT NULL THEN CONCAT(LPAD(${priority},2,'0'), ':', COALESCE(DATE_FORMAT(deadline,'%Y%m%d%H%i%s'),'99999999999999'), ':',actionCode,':',targetKind,':',targetId) END`;
  const stableFields = ['title','status','missionStatus','executionType','slug','requestedVehicleType','countryId','regionId','executor'];
  const grouped = `SELECT kind,id,${stableFields.map((field) => `MAX(${quote(field)}) AS ${quote(field)}`).join(',')},
    MIN(createdAt) AS createdAt, MIN(deadline) AS deadline, MAX(escalated) AS escalated, MIN(${token}) AS actionToken,
    SUM(stepSource) AS openStepCount, SUM(IF(stepSource = 1 AND actionCode IS NOT NULL,1,0)) AS actionStepCount, MAX(searchMatch) AS searchMatch
    FROM (${sources.join('\nUNION ALL\n')}) source_rows GROUP BY kind,id`;
  const filtersSql = [filters.kind !== 'all' ? 'kind = :kind' : '1=1', filters.q ? 'searchMatch = 1' : '1=1'].join(' AND ');
  params.kind = filters.kind;
  return { grouped, filtersSql, params };
}

async function listWorkspace(db, actor, filters) {
  const { grouped, filtersSql, params } = buildQueue(db, actor, filters);
  return db.sequelize.transaction({ readOnly: true, isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
    const options = { replacements: { ...params, limit: filters.limit, offset: (filters.page - 1) * filters.limit }, type: QueryTypes.SELECT, transaction, logging: false };
    const [summary] = await db.sequelize.query(`SELECT COALESCE(SUM(actionToken IS NOT NULL),0) AS action, COALESCE(SUM(actionToken IS NULL),0) AS following FROM (${grouped}) cases WHERE ${filtersSql}`, options);
    const rows = await db.sequelize.query(`SELECT * FROM (${grouped}) cases WHERE ${filtersSql} AND actionToken IS ${filters.view === 'action' ? 'NOT NULL' : 'NULL'}
      ORDER BY escalated DESC, CASE WHEN actionToken IS NULL THEN 99 ELSE CAST(SUBSTRING_INDEX(actionToken,':',1) AS UNSIGNED) END ASC,
      deadline IS NULL ASC, deadline ASC, createdAt ASC, kind ASC, id ASC LIMIT :limit OFFSET :offset`, options);
    const countryIds = [...new Set(rows.map((row) => row.countryId).filter(Boolean))];
    const regionIds = [...new Set(rows.map((row) => row.regionId).filter(Boolean))];
    const countries = countryIds.length ? await db.Country.findAll({ where: { id: { [Op.in]: countryIds } }, attributes: ['id','name'], transaction }) : [];
    const regions = regionIds.length ? await db.Region.findAll({ where: { id: { [Op.in]: regionIds } }, attributes: ['id','name'], transaction }) : [];
    const countryNames = new Map(countries.map((country) => [String(country.id), country.name]));
    const regionNames = new Map(regions.map((region) => [String(region.id), region.name]));
    const unread = await db.Notification.count({ where: { userId: actor.id, status: 'unread' }, transaction });
    return { items: rows.map(({ actionToken, searchMatch, ...row }) => {
      const token = actionToken?.split(':');
      return { ...row, id: Number(row.id), key: `${row.kind}:${row.id}`, openStepCount: Number(row.openStepCount), actionStepCount: Number(row.actionStepCount),
        countryName: countryNames.get(String(row.countryId)) || null, regionName: regionNames.get(String(row.regionId)) || null,
        action: token ? { code: token[2], kind: token[3], id: Number(token[4]) } : null };
    }), pagination: { page: filters.page, limit: filters.limit, total: Number(summary[filters.view]) },
    summary: { action: Number(summary.action), following: Number(summary.following), unread }, serverTime: new Date().toISOString() };
  });
}

module.exports = { listWorkspace };
