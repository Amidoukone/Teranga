'use strict';

const { Op } = require('sequelize');
const {
  Service,
  Task,
  Project,
  Order,
  Property,
  Transaction,
  User,
} = require('../../models');
const { applyGeoScopeForModel, getUserGeoScope, isGlobalAdmin, toSafeInt } = require('../utils/geoScope');
const { buildWhereWithACL, COMMON_INCLUDE } = require('../services/transaction.service');
const logger = require('../utils/logger');

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

const DASHBOARD_DEFAULTS = Object.freeze({
  serviceCounts: { total: 0, active: 0 },
  transactionAgg: {
    count: 0,
    financeSummary: {
      revenues: 0,
      expenses: 0,
      commissions: 0,
      adjustments: 0,
      balance: 0,
    },
    financeWidgetSummary: {
      revenue: 0,
      expense: 0,
      commission: 0,
      adjustment: 0,
    },
  },
  propertyCounts: { total: 0, active: 0 },
  taskCounts: {
    total: 0,
    created: 0,
    inProgress: 0,
    completed: 0,
    validated: 0,
  },
  projectCounts: {
    total: 0,
    created: 0,
    inProgress: 0,
    completed: 0,
    validated: 0,
  },
  orderCounts: { total: 0, paid: 0, open: 0 },
});

async function loadDashboardSections(req) {
  const sectionLoaders = [
    ['serviceCounts', () => countServices(req)],
    ['transactionAgg', () => countTransactionsAndFinance(req)],
    ['propertyCounts', () => countProperties(req)],
    ['taskCounts', () => countTasks(req)],
    ['projectCounts', () => countProjects(req)],
    ['orderCounts', () => countOrders(req)],
  ];

  const settled = await Promise.allSettled(
    sectionLoaders.map(([, run]) => run())
  );

  const sections = {};
  const failedSections = [];

  settled.forEach((result, index) => {
    const [name] = sectionLoaders[index];
    if (result.status === 'fulfilled') {
      sections[name] = result.value;
      return;
    }

    failedSections.push(name);
    sections[name] = DASHBOARD_DEFAULTS[name];
    logger.error(
      {
        section: name,
        err: result.reason,
        userId: req.user?.id ?? null,
        role: req.user?.role ?? null,
        query: req.query || {},
      },
      'dashboard.summary.section.failed'
    );
  });

  return { sections, failedSections };
}

function readScopedGeo(req) {
  return {
    countryId: toSafeInt(req.query?.countryId ?? req.query?.country_id),
    regionId: toSafeInt(req.query?.regionId ?? req.query?.region_id),
  };
}

function serviceWhereForDashboard(req) {
  const { countryId, regionId } = readScopedGeo(req);
  let where = {};

  if (req.user?.role === 'client') {
    where.clientId = req.user.id;
  } else if (req.user?.role === 'agent') {
    where.agentId = req.user.id;
  }

  if (countryId) where.countryId = countryId;
  if (regionId) where.regionId = regionId;

  return applyGeoScopeForModel
    ? applyGeoScopeForModel(where, req.user, Service, { includeClients: true })
    : where;
}

function propertyWhereForDashboard(req) {
  const { countryId, regionId } = readScopedGeo(req);

  // Le dashboard ne rend pas le module Biens pour les agents.
  if (req.user?.role === 'agent') return null;

  let where = {};
  if (req.user?.role === 'client') {
    where.ownerId = req.user.id;
  }

  if (countryId) where.countryId = countryId;
  if (regionId) where.regionId = regionId;

  return applyGeoScopeForModel
    ? applyGeoScopeForModel(where, req.user, Property, { includeClients: true })
    : where;
}

function projectWhereForDashboard(req) {
  const { countryId, regionId } = readScopedGeo(req);
  let where = {};

  if (req.user?.role === 'client') where.clientId = req.user.id;
  if (req.user?.role === 'agent') where.agentId = req.user.id;

  if (countryId) where.countryId = countryId;
  if (regionId) where.regionId = regionId;

  return applyGeoScopeForModel
    ? applyGeoScopeForModel(where, req.user, Project, { includeClients: true })
    : where;
}

function taskBaseQueryForDashboard(req) {
  const { countryId, regionId } = readScopedGeo(req);
  let where = {};

  if (countryId) where.countryId = countryId;
  if (regionId) where.regionId = regionId;

  if (req.user?.role === 'agent') {
    where[Op.or] = [
      { assignedTo: req.user.id },
      { '$service.agentId$': req.user.id },
    ];
  } else if (req.user?.role === 'client') {
    where[Op.or] = [
      { creatorId: req.user.id },
      { '$service.clientId$': req.user.id },
      { '$property.ownerId$': req.user.id },
    ];
  }

  where = applyGeoScopeForModel
    ? applyGeoScopeForModel(where, req.user, Task, { includeClients: true })
    : where;

  const include = [
    { model: Service, as: 'service', required: false, attributes: [] },
    { model: Property, as: 'property', required: false, attributes: [] },
  ];

  return { where, include };
}

function readOrderCountryId(obj) {
  return toSafeInt(obj?.countryId ?? obj?.country_id);
}

function readOrderRegionId(obj) {
  return toSafeInt(obj?.regionId ?? obj?.region_id);
}

function applyOrderScopeWhereForDashboard(where, req, { allowLegacyUserScope = true } = {}) {
  const role = req.user?.role;

  if (role === 'client') {
    const out = { ...where, userId: req.user.id };
    const qCountryId = readOrderCountryId(req.query);
    const qRegionId = readOrderRegionId(req.query);
    if (qCountryId) out.countryId = qCountryId;
    if (qRegionId) out.regionId = qRegionId;

    return applyGeoScopeForModel
      ? applyGeoScopeForModel(out, req.user, Order, { includeClients: true })
      : out;
  }

  if (isGlobalAdmin(req.user)) return where;

  if (!allowLegacyUserScope) {
    return applyGeoScopeForModel ? applyGeoScopeForModel(where, req.user, Order) : where;
  }

  const scope = getUserGeoScope ? getUserGeoScope(req.user) : {};
  const scopeCountryId = toSafeInt(scope.countryId);
  const scopeRegionId = toSafeInt(scope.regionId);

  if (!scopeCountryId && !scopeRegionId) return { ...where, id: 0 };

  const or = [];

  if (scopeRegionId) {
    or.push({ regionId: scopeRegionId });
    or.push({
      [Op.and]: [
        { regionId: null },
        { countryId: null },
        { '$user.region_id$': scopeRegionId },
      ],
    });
  } else if (scopeCountryId) {
    or.push({ countryId: scopeCountryId });
    or.push({
      [Op.and]: [
        { regionId: null },
        { countryId: null },
        { '$user.country_id$': scopeCountryId },
      ],
    });
  }

  const andFilters = Array.isArray(where[Op.and]) ? [...where[Op.and]] : [];
  andFilters.push({ [Op.or]: or });
  return { ...where, [Op.and]: andFilters };
}

function orderBaseQueryForDashboard(req) {
  const { countryId, regionId } = readScopedGeo(req);
  let where = {};
  if (countryId) where.countryId = countryId;
  if (regionId) where.regionId = regionId;

  where = applyOrderScopeWhereForDashboard(where, req, { allowLegacyUserScope: true });

  const include = [
    {
      model: User,
      as: 'user',
      required: false,
      attributes: [],
    },
  ];

  return { where, include };
}

async function countServices(req) {
  const baseWhere = serviceWhereForDashboard(req);
  const [total, active] = await Promise.all([
    Service.count({ where: baseWhere }),
    Service.count({
      where: {
        ...baseWhere,
        status: { [Op.notIn]: ['completed', 'validated'] },
      },
    }),
  ]);

  return {
    total: toNumber(total),
    active: toNumber(active),
  };
}

async function countTransactionsAndFinance(req) {
  const txWhere = buildWhereWithACL(req);

  const [count, revenues, expenses, commissions, adjustments] = await Promise.all([
    Transaction.count({
      where: txWhere,
      include: COMMON_INCLUDE,
      distinct: true,
    }),
    Transaction.sum('amount', {
      where: { ...txWhere, type: 'revenue' },
      include: COMMON_INCLUDE,
    }),
    Transaction.sum('amount', {
      where: { ...txWhere, type: 'expense' },
      include: COMMON_INCLUDE,
    }),
    Transaction.sum('amount', {
      where: { ...txWhere, type: 'commission' },
      include: COMMON_INCLUDE,
    }),
    Transaction.sum('amount', {
      where: { ...txWhere, type: 'adjustment' },
      include: COMMON_INCLUDE,
    }),
  ]);

  const normalized = {
    revenues: toNumber(revenues),
    expenses: toNumber(expenses),
    commissions: toNumber(commissions),
    adjustments: toNumber(adjustments),
  };

  const financeSummary = {
    ...normalized,
    balance:
      normalized.revenues -
      normalized.expenses -
      normalized.commissions +
      normalized.adjustments,
  };

  return {
    count: toNumber(count),
    financeSummary,
    financeWidgetSummary: {
      revenue: normalized.revenues,
      expense: normalized.expenses,
      commission: normalized.commissions,
      adjustment: normalized.adjustments,
    },
  };
}

async function countProperties(req) {
  const baseWhere = propertyWhereForDashboard(req);
  if (!baseWhere) {
    return { total: 0, active: 0 };
  }

  const [total, active] = await Promise.all([
    Property.count({ where: baseWhere }),
    Property.count({ where: { ...baseWhere, status: 'active' } }),
  ]);

  return { total: toNumber(total), active: toNumber(active) };
}

async function countTasks(req) {
  const { where, include } = taskBaseQueryForDashboard(req);
  const countOpts = {
    where,
    include,
    distinct: true,
    subQuery: false,
  };

  const [total, created, inProgress, completed, validated] = await Promise.all([
    Task.count(countOpts),
    Task.count({ ...countOpts, where: { ...where, status: 'created' } }),
    Task.count({ ...countOpts, where: { ...where, status: 'in_progress' } }),
    Task.count({ ...countOpts, where: { ...where, status: 'completed' } }),
    Task.count({ ...countOpts, where: { ...where, status: 'validated' } }),
  ]);

  return {
    total: toNumber(total),
    created: toNumber(created),
    inProgress: toNumber(inProgress),
    completed: toNumber(completed),
    validated: toNumber(validated),
  };
}

async function countProjects(req) {
  const baseWhere = projectWhereForDashboard(req);

  const [total, created, inProgress, completed, validated] = await Promise.all([
    Project.count({ where: baseWhere }),
    Project.count({ where: { ...baseWhere, status: 'created' } }),
    Project.count({ where: { ...baseWhere, status: 'in_progress' } }),
    Project.count({ where: { ...baseWhere, status: 'completed' } }),
    Project.count({ where: { ...baseWhere, status: 'validated' } }),
  ]);

  return {
    total: toNumber(total),
    created: toNumber(created),
    inProgress: toNumber(inProgress),
    completed: toNumber(completed),
    validated: toNumber(validated),
  };
}

async function countOrders(req) {
  const { where, include } = orderBaseQueryForDashboard(req);
  const countOpts = {
    where,
    include,
    distinct: true,
  };

  const [total, paid, open] = await Promise.all([
    Order.count(countOpts),
    Order.count({ ...countOpts, where: { ...where, paymentStatus: 'paid' } }),
    Order.count({
      ...countOpts,
      where: {
        ...where,
        status: { [Op.notIn]: ['delivered', 'cancelled', 'refunded'] },
      },
    }),
  ]);

  return {
    total: toNumber(total),
    paid: toNumber(paid),
    open: toNumber(open),
  };
}

exports.summary = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const role = String(req.user?.role || '').trim().toLowerCase();

    const { sections, failedSections } = await loadDashboardSections(req);
    const serviceCounts = sections.serviceCounts || DASHBOARD_DEFAULTS.serviceCounts;
    const transactionAgg = sections.transactionAgg || DASHBOARD_DEFAULTS.transactionAgg;
    const propertyCounts = sections.propertyCounts || DASHBOARD_DEFAULTS.propertyCounts;
    const taskCounts = sections.taskCounts || DASHBOARD_DEFAULTS.taskCounts;
    const projectCounts = sections.projectCounts || DASHBOARD_DEFAULTS.projectCounts;
    const orderCounts = sections.orderCounts || DASHBOARD_DEFAULTS.orderCounts;

    const { financeSummary, financeWidgetSummary } = transactionAgg;
    const dashboardTotalExpense =
      role === 'admin'
        ? financeSummary.expenses
        : financeSummary.expenses +
          financeSummary.commissions +
          financeSummary.adjustments;
    const dashboardBalance =
      role === 'admin'
        ? financeSummary.balance
        : financeSummary.revenues - dashboardTotalExpense;

    return res.json({
      stats: {
        servicesCount: serviceCounts.total,
        activeServices: serviceCounts.active,
        transactionsCount: transactionAgg.count,
        totalRevenue: financeSummary.revenues,
        totalExpense: dashboardTotalExpense,
        balance: dashboardBalance,
      },
      detailStats: {
        properties: propertyCounts,
        tasks: taskCounts,
        projects: projectCounts,
        orders: orderCounts,
      },
      financeSummary,
      financeWidgetSummary,
      meta: {
        role,
        generatedAt: new Date().toISOString(),
        partial: failedSections.length > 0,
        failedSections,
      },
    });
  } catch (e) {
    logger.error({ err: e }, 'dashboard.summary.failed');
    return res.status(500).json({
      error: 'Erreur lors du calcul du dashboard',
    });
  }
};
