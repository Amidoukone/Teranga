'use strict';

const {
  CLASSIC_CATALOG_DEFINITIONS,
} = require('../constants/serviceCatalog');

function key(value) {
  return value === null || value === undefined ? null : String(value);
}

function tradeDefinitionCode(slug) {
  return `TRADE:${String(slug || '').trim().toUpperCase()}`;
}

function classicDefinitionCode(serviceType) {
  return `CLASSIC:${String(serviceType || '').trim().toUpperCase()}`;
}

function tradeExecutionProfile(slug) {
  if (slug === 'mobilite') return 'mobility';
  if (slug === 'livraison') return 'delivery';
  return 'provider';
}

function tradeFamily(slug) {
  return ['mobilite', 'livraison'].includes(slug) ? 'frequency' : 'core';
}

function selectOperatingOrganization({ territory, assignments, organizationsById }) {
  const candidates = assignments
    .filter(
      (assignment) =>
        key(assignment.territoryId) === key(territory.id) &&
        assignment.status === 'active'
    )
    .map((assignment) => ({
      assignment,
      organization: organizationsById.get(key(assignment.organizationId)),
    }))
    .filter(({ organization }) => organization?.status === 'active');

  if (candidates.length === 1) return { organization: candidates[0].organization };

  const primary = candidates.filter(({ assignment }) => Boolean(assignment.isPrimary));
  if (primary.length === 1) return { organization: primary[0].organization };

  return {
    organization: null,
    candidateIds: candidates.map(({ organization }) => organization.id),
  };
}

function buildCatalogProjection({
  tradeCategories = [],
  countries = [],
  territories = [],
  organizations = [],
  organizationTerritories = [],
} = {}) {
  const issues = [];
  const definitionPlans = [];
  const availabilities = [];
  const countriesById = new Map(countries.map((country) => [key(country.id), country]));
  const organizationsById = new Map(
    organizations.map((organization) => [key(organization.id), organization])
  );
  const activeCountryTerritories = territories.filter(
    (territory) => territory.type === 'COUNTRY' && territory.isActive !== false
  );
  const operatorSelections = new Map();

  for (const territory of territories.filter((item) => item.isActive !== false)) {
    const selection = selectOperatingOrganization({
      territory,
      assignments: organizationTerritories,
      organizationsById,
    });
    operatorSelections.set(key(territory.id), selection);

    if (
      territory.type === 'COUNTRY' &&
      !selection.organization &&
      (selection.candidateIds || []).length === 0
    ) {
      issues.push({
        severity: 'warning',
        code: 'CATALOG_COUNTRY_NOT_OPERATED',
        entityType: 'Territory',
        entityId: territory.id,
        details: { countryId: territory.countryId },
      });
    }
    if ((selection.candidateIds || []).length > 1) {
      issues.push({
        severity: 'blocking',
        code: 'CATALOG_TERRITORY_OPERATOR_AMBIGUOUS',
        entityType: 'Territory',
        entityId: territory.id,
        details: { organizationCandidates: selection.candidateIds },
      });
    }
  }

  for (const category of tradeCategories) {
    definitionPlans.push({
      definition: {
        code: tradeDefinitionCode(category.slug),
        name: category.name,
        description: null,
        family: tradeFamily(category.slug),
        executionProfile: tradeExecutionProfile(category.slug),
        legacyTradeCategoryId: category.id,
        legacyServiceType: null,
        requiredEvidenceTypes: null,
        intakeSchema: null,
        version: 1,
        isActive: category.isActive !== false,
      },
      scope: { countryId: category.countryId, regionId: category.regionId },
    });
  }

  for (const classic of CLASSIC_CATALOG_DEFINITIONS) {
    definitionPlans.push({
      definition: {
        code: classicDefinitionCode(classic.key),
        name: classic.name,
        description: null,
        family: 'core',
        executionProfile: 'agent',
        legacyTradeCategoryId: null,
        legacyServiceType: classic.key,
        requiredEvidenceTypes: null,
        intakeSchema: null,
        version: 1,
        isActive: true,
      },
      scope: { countryId: null, regionId: null },
    });
  }

  for (const plan of definitionPlans) {
    const { definition, scope } = plan;
    let targetTerritories;
    let projectedAvailabilityCount = 0;

    if (scope.regionId) {
      targetTerritories = territories.filter(
        (territory) =>
          key(territory.regionId) === key(scope.regionId) && territory.isActive !== false
      );
    } else if (scope.countryId) {
      targetTerritories = activeCountryTerritories.filter(
        (territory) => key(territory.countryId) === key(scope.countryId)
      );
    } else {
      targetTerritories = activeCountryTerritories;
    }

    if (targetTerritories.length === 0 && definition.isActive) {
      issues.push({
        severity: 'blocking',
        code: 'CATALOG_DEFINITION_WITHOUT_TERRITORY',
        entityType: 'ServiceDefinition',
        entityId: definition.code,
        details: scope,
      });
      continue;
    }

    for (const territory of targetTerritories) {
      const selection = operatorSelections.get(key(territory.id)) || {};
      if (!selection.organization) {
        if (scope.countryId || scope.regionId) {
          issues.push({
            severity: 'blocking',
            code: 'CATALOG_SCOPED_DEFINITION_WITHOUT_OPERATOR',
            entityType: 'ServiceDefinition',
            entityId: definition.code,
            details: {
              territoryId: territory.id,
              organizationCandidates: selection.candidateIds || [],
            },
          });
        }
        continue;
      }

      const country = countriesById.get(key(territory.countryId));
      availabilities.push({
        definitionCode: definition.code,
        territoryId: territory.id,
        organizationId: selection.organization.id,
        currency: country?.currency || 'XOF',
        basePrice: null,
        slaMinutes: null,
        openingHours: null,
        requiredFields: null,
        providerRules: null,
        version: 1,
        isActive: definition.isActive,
        validFrom: null,
        validUntil: null,
      });
      projectedAvailabilityCount += 1;
    }

    if (definition.isActive && projectedAvailabilityCount === 0) {
      issues.push({
        severity: 'blocking',
        code: 'CATALOG_DEFINITION_WITHOUT_AVAILABILITY',
        entityType: 'ServiceDefinition',
        entityId: definition.code,
        details: scope,
      });
    }
  }

  const blockingIssues = issues.filter((issue) => issue.severity === 'blocking');
  return {
    definitions: definitionPlans.map(({ definition }) => definition),
    availabilities,
    issues,
    summary: {
      definitions: definitionPlans.length,
      availabilities: availabilities.length,
      warnings: issues.length - blockingIssues.length,
      blockingIssues: blockingIssues.length,
      readyToApply: blockingIssues.length === 0,
    },
  };
}

async function loadCatalogProjection(db) {
  const [tradeCategories, countries, territories, organizations, organizationTerritories] =
    await Promise.all([
      db.TradeCategory.findAll({ raw: true }),
      db.Country.findAll({ where: { isActive: true }, raw: true }),
      db.Territory.findAll({ where: { isActive: true }, raw: true }),
      db.Organization.findAll({ where: { status: 'active' }, raw: true }),
      db.OrganizationTerritory.findAll({ where: { status: 'active' }, raw: true }),
    ]);

  return buildCatalogProjection({
    tradeCategories,
    countries,
    territories,
    organizations,
    organizationTerritories,
  });
}

async function applyCatalogProjection(db, projection) {
  if (!projection?.summary?.readyToApply) {
    const error = new Error('Service catalog projection contains blocking issues');
    error.code = 'SERVICE_CATALOG_PROJECTION_BLOCKED';
    error.issues = projection?.issues || [];
    throw error;
  }

  return db.sequelize.transaction(async (transaction) => {
    const definitionIds = new Map();
    const stats = {
      definitionsCreated: 0,
      definitionsUpdated: 0,
      availabilitiesCreated: 0,
      availabilitiesUpdated: 0,
    };

    for (const definition of projection.definitions) {
      const [instance, created] = await db.ServiceDefinition.findOrCreate({
        where: { code: definition.code },
        defaults: definition,
        transaction,
      });
      if (!created) await instance.update(definition, { transaction });
      definitionIds.set(definition.code, instance.id);
      stats[created ? 'definitionsCreated' : 'definitionsUpdated'] += 1;
    }

    for (const availability of projection.availabilities) {
      const { definitionCode, ...values } = availability;
      const serviceDefinitionId = definitionIds.get(definitionCode);
      const where = {
        serviceDefinitionId,
        territoryId: values.territoryId,
        organizationId: values.organizationId,
      };
      const [instance, created] = await db.ServiceAvailability.findOrCreate({
        where,
        defaults: values,
        transaction,
      });
      if (!created) await instance.update(values, { transaction });
      stats[created ? 'availabilitiesCreated' : 'availabilitiesUpdated'] += 1;
    }

    return stats;
  });
}

module.exports = {
  buildCatalogProjection,
  loadCatalogProjection,
  applyCatalogProjection,
  tradeDefinitionCode,
  classicDefinitionCode,
};
