'use strict';

const GEO_MODEL_POLICIES = Object.freeze({
  User: { category: 'identity', requiresCountry: false },
  Franchise: { category: 'organization', requiresCountry: true },
  Property: { category: 'operational', requiresCountry: true },
  Service: { category: 'operational', requiresCountry: true },
  Task: { category: 'operational', requiresCountry: true },
  Evidence: { category: 'operational', requiresCountry: true },
  Transaction: { category: 'operational', requiresCountry: true },
  Project: { category: 'operational', requiresCountry: true },
  Product: { category: 'catalog', requiresCountry: true },
  Order: { category: 'operational', requiresCountry: true },
  PropertyListing: { category: 'catalog', requiresCountry: true },
  TradeCategory: { category: 'catalog', requiresCountry: false },
  MissionPricingRule: { category: 'configuration', requiresCountry: false },
  Activity: { category: 'event', requiresCountry: false },
  Notification: { category: 'event', requiresCountry: false },
});

function normalizeTableName(tableName) {
  if (typeof tableName === 'string') return tableName;
  if (tableName && typeof tableName === 'object') {
    return tableName.tableName || tableName.name || Object.values(tableName)[0];
  }
  return String(tableName || '');
}

function attributeField(model, attributeName) {
  const attribute = model?.rawAttributes?.[attributeName];
  if (!attribute) return null;
  return attribute.field || attribute.fieldName || attributeName;
}

function quoteIdentifier(value) {
  return `\`${String(value || '').replace(/`/g, '``')}\``;
}

function resolveGeoModelDescriptor(modelName, model) {
  if (!model?.rawAttributes) return null;

  const countryAttribute = model.rawAttributes.countryId
    ? 'countryId'
    : model.rawAttributes.country_id
    ? 'country_id'
    : null;
  const regionAttribute = model.rawAttributes.regionId
    ? 'regionId'
    : model.rawAttributes.region_id
    ? 'region_id'
    : null;

  if (!countryAttribute || !regionAttribute) return null;

  const tableName = normalizeTableName(model.getTableName());
  if (!tableName) return null;

  return {
    modelName,
    tableName,
    countryColumn: attributeField(model, countryAttribute),
    regionColumn: attributeField(model, regionAttribute),
    ...(GEO_MODEL_POLICIES[modelName] || {
      category: 'other',
      requiresCountry: false,
    }),
  };
}

function buildGeoIntegrityQuery(descriptor) {
  const table = quoteIdentifier(descriptor.tableName);
  const country = `t.${quoteIdentifier(descriptor.countryColumn)}`;
  const region = `t.${quoteIdentifier(descriptor.regionColumn)}`;

  return [
    'SELECT',
    'COUNT(*) AS total,',
    `COALESCE(SUM(${country} IS NULL), 0) AS missingCountry,`,
    `COALESCE(SUM(${region} IS NULL), 0) AS missingRegion,`,
    `COALESCE(SUM(${region} IS NOT NULL AND ${country} IS NULL), 0) AS regionWithoutCountry,`,
    `COALESCE(SUM(${country} IS NOT NULL AND c.id IS NULL), 0) AS unknownCountry,`,
    `COALESCE(SUM(${region} IS NOT NULL AND r.id IS NULL), 0) AS unknownRegion,`,
    `COALESCE(SUM(${region} IS NOT NULL AND ${country} IS NOT NULL AND r.id IS NOT NULL AND r.country_id <> ${country}), 0) AS regionCountryMismatch`,
    `FROM ${table} t`,
    `LEFT JOIN ${quoteIdentifier('countries')} c ON c.id = ${country}`,
    `LEFT JOIN ${quoteIdentifier('regions')} r ON r.id = ${region}`,
  ].join('\n');
}

function toCount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStats(row = {}) {
  return {
    total: toCount(row.total),
    missingCountry: toCount(row.missingCountry),
    missingRegion: toCount(row.missingRegion),
    regionWithoutCountry: toCount(row.regionWithoutCountry),
    unknownCountry: toCount(row.unknownCountry),
    unknownRegion: toCount(row.unknownRegion),
    regionCountryMismatch: toCount(row.regionCountryMismatch),
  };
}

function summarizeGeoIntegrity(rows) {
  const totals = rows.reduce(
    (summary, item) => {
      const stats = item.stats;
      summary.records += stats.total;
      summary.missingRequiredCountry += item.requiresCountry
        ? stats.missingCountry
        : 0;
      summary.strictRegionVisibilityImpact +=
        item.category === 'operational'
          ? Math.max(stats.missingRegion - stats.missingCountry, 0)
          : 0;
      summary.blockingAnomalies +=
        stats.regionWithoutCountry +
        stats.unknownCountry +
        stats.unknownRegion +
        stats.regionCountryMismatch;
      return summary;
    },
    {
      records: 0,
      missingRequiredCountry: 0,
      strictRegionVisibilityImpact: 0,
      blockingAnomalies: 0,
    }
  );

  return {
    ...totals,
    readyForStrictRegionScope:
      totals.blockingAnomalies === 0 &&
      totals.missingRequiredCountry === 0 &&
      totals.strictRegionVisibilityImpact === 0,
  };
}

async function auditGeoIntegrity(db) {
  if (!db?.sequelize?.query) {
    throw new Error('Une connexion Sequelize est requise pour auditer le geo-scope');
  }

  const discoveredDescriptors = Object.entries(db)
    .map(([modelName, model]) => resolveGeoModelDescriptor(modelName, model))
    .filter(Boolean)
    .sort((a, b) => a.tableName.localeCompare(b.tableName));

  const queryInterface = db.sequelize.getQueryInterface?.();
  const showAllTables = queryInterface?.showAllTables;
  let descriptors = discoveredDescriptors;
  let skippedTables = [];

  if (typeof showAllTables === 'function') {
    const rawTables = await showAllTables.call(queryInterface);
    const availableTables = new Set(rawTables.map(normalizeTableName));
    descriptors = discoveredDescriptors.filter((descriptor) =>
      availableTables.has(descriptor.tableName)
    );
    skippedTables = discoveredDescriptors
      .filter((descriptor) => !availableTables.has(descriptor.tableName))
      .map((descriptor) => descriptor.tableName);
  }

  const tables = [];
  for (const descriptor of descriptors) {
    const [result] = await db.sequelize.query(buildGeoIntegrityQuery(descriptor));
    const row = Array.isArray(result) ? result[0] : result;
    tables.push({
      ...descriptor,
      stats: normalizeStats(row),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only',
    tables,
    skippedTables,
    summary: summarizeGeoIntegrity(tables),
  };
}

module.exports = {
  GEO_MODEL_POLICIES,
  normalizeTableName,
  resolveGeoModelDescriptor,
  buildGeoIntegrityQuery,
  normalizeStats,
  summarizeGeoIntegrity,
  auditGeoIntegrity,
};
