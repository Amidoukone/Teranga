'use strict';

const { Op } = require('sequelize');
const {
  Transaction,
  User,
  Service,
  Task,
  Order,
  Project,
} = require('../../models');
const { getPagination: baseGetPagination } = require('../utils/pagination');

/* =========================================================
   🔧 Helpers génériques
========================================================= */
function toSafeInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function toNullableNumber(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toTrimOrNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function getPagination(req, defaultLimit = 25, maxLimit = 200) {
  return baseGetPagination(req, defaultLimit, maxLimit);
}

/**
 * Pagination robuste et rétro-compatible :
 * - supporte limit/offset
 * - expose aussi page (si fourni) sinon calculé depuis offset/limit
 */
/* =========================================================
   🔐 Helpers GEO (admin scoped)
   - Admin global : role=admin ET (countryId==null && regionId==null)
   - Admin scoped : role=admin ET (countryId!=null OU regionId!=null)
========================================================= */
function isAdmin(user) {
  return user?.role === 'admin';
}

function getUserGeoScope(user) {
  return {
    countryId: user?.countryId ?? null,
    regionId: user?.regionId ?? null,
  };
}

function isGlobalAdmin(user) {
  if (!isAdmin(user)) return false;
  const { countryId, regionId } = getUserGeoScope(user);
  return countryId == null && regionId == null;
}

function applyGeoScope(where, user) {
  if (!isAdmin(user)) return where;
  if (isGlobalAdmin(user)) return where;

  const { countryId, regionId } = getUserGeoScope(user);

  // Non-destructif : on n’écrase pas un filtre déjà fourni explicitement
  if (countryId != null && where.countryId == null) where.countryId = countryId;
  if (regionId != null && where.regionId == null) where.regionId = regionId;

  return where;
}

function buildStrictGeoFilter(user) {
  if (!user) return {};
  if (isGlobalAdmin(user)) return {};

  const { countryId, regionId } = getUserGeoScope(user);

  if (regionId != null) return { regionId };
  if (countryId != null) return { countryId };

  return { id: 0 };
}

function resolveGeoFromTransactionLinks(trx) {
  return {
    countryId:
      trx?.countryId ??
      trx?.order?.countryId ??
      trx?.service?.countryId ??
      trx?.task?.countryId ??
      trx?.project?.countryId ??
      trx?.user?.countryId ??
      null,
    regionId:
      trx?.regionId ??
      trx?.order?.regionId ??
      trx?.service?.regionId ??
      trx?.task?.regionId ??
      trx?.project?.regionId ??
      trx?.user?.regionId ??
      null,
  };
}

function passesGeoScopeForUser(user, trx) {
  const scope = buildStrictGeoFilter(user);

  if (scope.id === 0) return false;

  if (scope.regionId == null && scope.countryId == null) return true;

  const geo = resolveGeoFromTransactionLinks(trx);

  if (scope.regionId != null) {
    return geo.regionId != null && String(geo.regionId) === String(scope.regionId);
  }

  if (scope.countryId != null) {
    return geo.countryId != null && String(geo.countryId) === String(scope.countryId);
  }

  return true;
}

/* =========================================================
   🔐 WHERE + ACL par rôle
   - filtre par serviceId / taskId / orderId / projectId
   - applique les règles admin global / admin scoped / agent / client
   - conserve les filtres existants (search, dates, etc.)
========================================================= */
function buildWhereWithACL(req) {
  const where = {};
  const query = req?.query || {};

  const sid = toSafeInt(query.serviceId);
  const tid = toSafeInt(query.taskId);
  const oid = toSafeInt(query.orderId);
  const pid = toSafeInt(query.projectId);
  const qCountryId = toSafeInt(query.countryId ?? query.country_id);
  const qRegionId = toSafeInt(query.regionId ?? query.region_id);

  // 🔗 filtres directs sur les IDs liés
  if (sid) where.serviceId = sid;
  if (tid) where.taskId = tid;
  if (oid) where.orderId = oid;
  if (pid) where.projectId = pid;

  // type / status (legacy)
  if (query.type) where.type = String(query.type).trim();
  if (query.status) where.status = String(query.status).trim();

  // filtrage par date
  if (query.startDate && query.endDate) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      where.createdAt = { [Op.between]: [start, end] };
    }
  }

  const role = req.user?.role;
  const userId = req.user?.id;

  // ======================================================
  // ACL par rôle + GEO scope
  // ======================================================
  if (role === 'admin') {
    // ✅ Admin global: accès complet
    if (!isGlobalAdmin(req.user)) {
      const scope = getUserGeoScope(req.user);
      const scopeOr = [];

      if (scope.regionId != null) {
        scopeOr.push(
          { regionId: scope.regionId },
          { '$service.regionId$': scope.regionId },
          { '$task.regionId$': scope.regionId },
          { '$order.region_id$': scope.regionId },
          { '$project.regionId$': scope.regionId }
        );

        // fallback legacy: trx sans geo -> scope via user
        scopeOr.push({
          [Op.and]: [
            { regionId: null },
            { countryId: null },
            { '$user.region_id$': scope.regionId },
          ],
        });
      } else if (scope.countryId != null) {
        scopeOr.push(
          { countryId: scope.countryId },
          { '$service.countryId$': scope.countryId },
          { '$task.countryId$': scope.countryId },
          { '$order.country_id$': scope.countryId },
          { '$project.countryId$': scope.countryId }
        );

        // fallback legacy: trx sans geo -> scope via user
        scopeOr.push({
          [Op.and]: [
            { regionId: null },
            { countryId: null },
            { '$user.country_id$': scope.countryId },
          ],
        });
      }

      if (scopeOr.length > 0) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({ [Op.or]: scopeOr });
      }
    } else {
      // Admin global: filtre réactif si pays/région sélectionnés
      if (qCountryId) where.countryId = qCountryId;
      if (qRegionId) where.regionId = qRegionId;
    }
  } else if (role === 'agent') {
    // Agent :
    //  - transactions créées par lui
    //  - liées à un service dont il est agent
    //  - liées à une task qui lui est assignée
    //  - liées à un projet dont il est agent
    where[Op.or] = [
      { userId },
      { '$service.agentId$': userId },
      { '$task.assignedTo$': userId },
      { '$project.agentId$': userId },
    ];

    Object.assign(where, buildStrictGeoFilter(req.user));
  } else if (role === 'client') {
    // Client :
    //  - transactions créées par lui
    //  - liées à un service où il est client
    //  - liées à une task qu’il a créée
    //  - liées à un projet dont il est client
    where[Op.or] = [
      { userId },
      { '$service.clientId$': userId },
      { '$task.creatorId$': userId },
      { '$project.clientId$': userId },
    ];

    Object.assign(where, buildStrictGeoFilter(req.user));
  }

  // Recherche texte simple (description + paymentMethod)
  const q = (query.q || '').trim();
  if (q) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        { description: { [Op.like]: `%${q}%` } },
        { paymentMethod: { [Op.like]: `%${q}%` } },
      ],
    });
  }

  return where;
}

/* =========================================================
   🔗 Includes communs pour toutes les queries de Transaction
   - permet ACL avec $alias.colonne$
   - permet affichage (service, task, order, project, user)
   - ✅ Ajoute countryId/regionId sur les modules (si présents) pour debug/filtre
========================================================= */
const COMMON_INCLUDE = [
  {
    model: User,
    as: 'user',
    required: false,
    attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'countryId', 'regionId'],
  },
  {
    model: Service,
    as: 'service',
    required: false,
    attributes: ['id', 'title', 'clientId', 'agentId', 'countryId', 'regionId'],
  },
  {
    model: Task,
    as: 'task',
    required: false,
    attributes: ['id', 'title', 'serviceId', 'assignedTo', 'creatorId', 'countryId', 'regionId'],
  },
  {
    model: Order,
    as: 'order',
    required: false,
    attributes: ['id', 'code', 'status', 'userId', 'countryId', 'regionId'],
  },
  {
    model: Project,
    as: 'project',
    required: false,
    attributes: ['id', 'title', 'clientId', 'agentId', 'status', 'countryId', 'regionId'],
  },
];

/* =========================================================
   🔐 canAccessTransaction
   - vérifie l'accès à une transaction donnée
   - recharge la transaction avec COMMON_INCLUDE si besoin
   - ✅ applique aussi le scope GEO pour admin scoped
========================================================= */
async function canAccessTransaction(req, trx) {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    if (!role || !userId) return false;

    // ✅ Admin global: OK
    // ✅ Master (admin scoped): OK seulement si trx dans le scope
    if (role === 'admin') {
      if (isGlobalAdmin(req.user)) return true;

      // si trx a déjà countryId/regionId => check direct, sinon reload
      const scope = getUserGeoScope(req.user);

      const trxCountryId = trx?.countryId ?? null;
      const trxRegionId = trx?.regionId ?? null;

      // Si on a les infos, on valide sans reload
      if (trxCountryId != null || trxRegionId != null) {
        if (scope.countryId != null && trxCountryId !== scope.countryId) return false;
        if (scope.regionId != null && trxRegionId !== scope.regionId) return false;
        return true;
      }

      // Sinon recharge et check
      const re = await Transaction.findByPk(trx.id, { include: COMMON_INCLUDE });
      if (!re) return false;

      const cId = re.countryId ?? null;
      const rId = re.regionId ?? null;

      if (scope.countryId != null && cId !== scope.countryId) return false;
      if (scope.regionId != null && rId !== scope.regionId) return false;

      return true;
    }

    // S’assurer d’avoir les alias nécessaires (pour agent/client)
    const hasAll = trx?.user || trx?.service || trx?.task || trx?.order || trx?.project;

    let t = trx;
    if (!hasAll) {
      t = await Transaction.findByPk(trx.id, { include: COMMON_INCLUDE });
      if (!t) return false;
    }

    // propriétaire direct
    if (t.userId === userId) return true;

    if (role === 'agent') {
      const isRelated =
        (t?.service && t.service.agentId === userId) ||
        (t?.task && t.task.assignedTo === userId) ||
        (t?.project && t.project.agentId === userId);

      if (!isRelated) return false;
      return passesGeoScopeForUser(req.user, t);
    }

    if (role === 'client') {
      const isRelated =
        (t?.service && t.service.clientId === userId) ||
        (t?.task && t.task.creatorId === userId) ||
        (t?.project && t.project.clientId === userId) ||
        t.userId === userId;

      if (!isRelated) return false;
      return passesGeoScopeForUser(req.user, t);
    }

    return false;
  } catch (e) {
    console.error('❌ canAccessTransaction error:', e);
    return false;
  }
}

module.exports = {
  toSafeInt,
  toNullableNumber,
  toTrimOrNull,
  getPagination,
  buildWhereWithACL,
  COMMON_INCLUDE,
  canAccessTransaction,
  buildStrictGeoFilter,
  resolveGeoFromTransactionLinks,

  // exports utilitaires GEO (optionnels, non cassants)
  applyGeoScope,
  getUserGeoScope,
  isGlobalAdmin,
};
