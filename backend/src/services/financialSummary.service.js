'use strict';

const { Op, fn, col } = require('sequelize');
const { Transaction } = require('../../models');
const { buildWhereWithACL, COMMON_INCLUDE, toSafeInt } = require('./transaction.service');
const { normalizeCurrency } = require('../utils/currency');

const EMPTY_TOTALS = { revenues: 0, expenses: 0, commissions: 0, adjustments: 0, balance: 0 };
const TYPE_KEYS = { revenue: 'revenues', expense: 'expenses', commission: 'commissions', adjustment: 'adjustments' };

function buildFinancialWhere(req, extra = {}) {
  const scope = buildWhereWithACL(req);
  const filters = { ...extra };
  const countryId = toSafeInt(req.query?.countryId ?? req.query?.country_id);
  const regionId = toSafeInt(req.query?.regionId ?? req.query?.region_id);
  if (countryId) filters.countryId = countryId;
  if (regionId) filters.regionId = regionId;
  if (req.query?.currency) filters.currency = String(req.query.currency).trim().toUpperCase();
  // Les filtres demandés restreignent les droits ; ils ne les remplacent jamais.
  return { [Op.and]: [scope, filters] };
}

async function loadFinancialSummary(req, extraWhere = {}) {
  const rows = await Transaction.findAll({
    where: buildFinancialWhere(req, extraWhere),
    attributes: ['currency', 'type', [fn('SUM', col('Transaction.amount')), 'amount'], [fn('COUNT', col('Transaction.id')), 'count']],
    include: COMMON_INCLUDE.map((include) => ({ ...include, attributes: [] })),
    group: ['Transaction.currency', 'Transaction.type'],
    raw: true,
  });
  const grouped = new Map();
  for (const row of rows) {
    const currency = normalizeCurrency(row.currency);
    const totals = grouped.get(currency) || { currency, ...EMPTY_TOTALS, count: 0 };
    const key = TYPE_KEYS[row.type];
    if (key) totals[key] += Number(row.amount) || 0;
    totals.count += Number(row.count) || 0;
    grouped.set(currency, totals);
  }
  const byCurrency = [...grouped.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  for (const totals of byCurrency) {
    totals.balance = totals.revenues - totals.expenses - totals.commissions + totals.adjustments;
  }
  const multiCurrency = byCurrency.length > 1;
  const totals = multiCurrency
    ? Object.fromEntries(Object.keys(EMPTY_TOTALS).map((key) => [key, null]))
    : byCurrency[0] || EMPTY_TOTALS;
  return {
    ...totals,
    currency: byCurrency.length === 1 ? byCurrency[0].currency : null,
    count: byCurrency.reduce((count, item) => count + item.count, 0),
    multiCurrency,
    byCurrency,
  };
}

module.exports = { buildFinancialWhere, loadFinancialSummary };
