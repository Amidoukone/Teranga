'use strict';

function key(value) {
  return value === null || value === undefined ? null : String(value);
}

function sourceMetadata(type, id) {
  return { projection: { sourceType: type, sourceId: key(id), version: 1 } };
}

function countryTerritoryCode(countryId) {
  return `LEGACY:COUNTRY:${countryId}`;
}

function regionTerritoryCode(regionId) {
  return `LEGACY:REGION:${regionId}`;
}

function franchiseOrganizationCode(franchiseId) {
  return `LEGACY:FRANCHISE:${franchiseId}`;
}

function buildTerritorialProjection({
  countries = [],
  regions = [],
  franchises = [],
  users = [],
  headquartersName = 'Teranga',
} = {}) {
  const issues = [];
  const territories = [];
  const organizations = [
    {
      code: 'TERANGA-HQ',
      type: 'HEADQUARTERS',
      parentOrganizationCode: null,
      countryId: null,
      regionId: null,
      legalName: headquartersName,
      displayName: headquartersName,
      status: 'active',
      metadata: sourceMetadata('system', 'headquarters'),
    },
  ];
  const organizationTerritories = [];
  const memberships = [];

  const countriesById = new Map(countries.map((country) => [key(country.id), country]));
  const regionsById = new Map(regions.map((region) => [key(region.id), region]));

  for (const country of countries) {
    territories.push({
      code: countryTerritoryCode(country.id),
      type: 'COUNTRY',
      parentCode: null,
      countryId: country.id,
      regionId: null,
      name: country.name,
      timezone: null,
      aliases: [country.isoCode].filter(Boolean),
      isActive: country.isActive !== false,
    });
  }

  for (const region of regions) {
    if (!countriesById.has(key(region.countryId))) {
      issues.push({
        severity: 'blocking',
        code: 'REGION_WITH_UNKNOWN_COUNTRY',
        entityType: 'Region',
        entityId: region.id,
        details: { countryId: region.countryId },
      });
      continue;
    }

    territories.push({
      code: regionTerritoryCode(region.id),
      type: 'REGION',
      parentCode: countryTerritoryCode(region.countryId),
      countryId: region.countryId,
      regionId: region.id,
      name: region.name,
      timezone: null,
      aliases: [region.code].filter(Boolean),
      isActive: region.isActive !== false,
    });
  }

  const mastersByCountry = new Map();
  const regionalOrganizationsByRegion = new Map();

  for (const franchise of franchises) {
    const organizationCode = franchiseOrganizationCode(franchise.id);
    const countryId = key(franchise.countryId);
    const regionId = key(franchise.regionId);

    if (!countriesById.has(countryId)) {
      issues.push({
        severity: 'blocking',
        code: 'FRANCHISE_WITH_UNKNOWN_COUNTRY',
        entityType: 'Franchise',
        entityId: franchise.id,
        details: { countryId: franchise.countryId },
      });
      continue;
    }

    const franchiseRegion = regionsById.get(regionId);
    if (
      franchise.type === 'REGIONAL' &&
      (!franchiseRegion || key(franchiseRegion.countryId) !== countryId)
    ) {
      issues.push({
        severity: 'blocking',
        code: 'REGIONAL_FRANCHISE_SCOPE_INCOHERENT',
        entityType: 'Franchise',
        entityId: franchise.id,
        details: { regionId: franchise.regionId },
      });
      continue;
    }

    const parentOrganizationCode =
      franchise.type === 'REGIONAL'
        ? null
        : 'TERANGA-HQ';

    organizations.push({
      code: organizationCode,
      type: franchise.type,
      parentOrganizationCode,
      countryId: franchise.countryId,
      regionId: franchise.regionId,
      legalName: franchise.legalName,
      displayName: franchise.legalName,
      status: franchise.status,
      metadata: sourceMetadata('legacy_franchise', franchise.id),
    });

    if (franchise.type === 'MASTER') {
      const matches = mastersByCountry.get(countryId) || [];
      matches.push(organizationCode);
      mastersByCountry.set(countryId, matches);
      organizationTerritories.push({
        organizationCode,
        territoryCode: countryTerritoryCode(franchise.countryId),
        isPrimary: true,
        isExclusive: false,
        status: franchise.status === 'active' ? 'active' : 'inactive',
      });
    } else {
      const matches = regionalOrganizationsByRegion.get(regionId) || [];
      matches.push(organizationCode);
      regionalOrganizationsByRegion.set(regionId, matches);
      organizationTerritories.push({
        organizationCode,
        territoryCode: regionTerritoryCode(franchise.regionId),
        isPrimary: true,
        isExclusive: false,
        status: franchise.status === 'active' ? 'active' : 'inactive',
      });
    }
  }

  for (const organization of organizations) {
    if (organization.type !== 'REGIONAL') continue;
    const masterMatches = mastersByCountry.get(key(organization.countryId)) || [];
    if (masterMatches.length === 1) {
      organization.parentOrganizationCode = masterMatches[0];
      continue;
    }

    organization.parentOrganizationCode = 'TERANGA-HQ';
    issues.push({
      severity: 'warning',
      code: 'REGIONAL_ORGANIZATION_WITHOUT_UNIQUE_MASTER',
      entityType: 'Organization',
      entityId: organization.code,
      details: {
        countryId: organization.countryId,
        masterCandidates: masterMatches,
      },
    });
  }

  for (const user of users) {
    if (user.role !== 'admin') continue;

    const countryId = key(user.countryId);
    const regionId = key(user.regionId);
    let organizationCode = 'TERANGA-HQ';
    let territoryCode = null;
    let roleKey = 'global_admin';

    if (regionId !== null) {
      if (countryId === null) {
        issues.push({
          severity: 'blocking',
          code: 'REGIONAL_ADMIN_WITHOUT_COUNTRY',
          entityType: 'User',
          entityId: user.id,
          details: { regionId: user.regionId },
        });
        continue;
      }

      const region = regionsById.get(regionId);
      const candidates = regionalOrganizationsByRegion.get(regionId) || [];
      if (!region || key(region.countryId) !== countryId || candidates.length !== 1) {
        issues.push({
          severity: 'blocking',
          code: 'REGIONAL_ADMIN_SCOPE_AMBIGUOUS',
          entityType: 'User',
          entityId: user.id,
          details: {
            countryId: user.countryId,
            regionId: user.regionId,
            organizationCandidates: candidates,
          },
        });
        continue;
      }

      organizationCode = candidates[0];
      territoryCode = regionTerritoryCode(user.regionId);
      roleKey = 'regional_admin';
    } else if (countryId !== null) {
      const candidates = mastersByCountry.get(countryId) || [];
      if (candidates.length !== 1) {
        issues.push({
          severity: 'blocking',
          code: 'COUNTRY_ADMIN_SCOPE_AMBIGUOUS',
          entityType: 'User',
          entityId: user.id,
          details: {
            countryId: user.countryId,
            organizationCandidates: candidates,
          },
        });
        continue;
      }

      organizationCode = candidates[0];
      territoryCode = countryTerritoryCode(user.countryId);
      roleKey = 'country_admin';
    }

    memberships.push({
      userId: user.id,
      organizationCode,
      territoryCode,
      roleKey,
      permissions: null,
      status: 'active',
    });
  }

  const blockingIssues = issues.filter((issue) => issue.severity === 'blocking');

  return {
    territories,
    organizations,
    organizationTerritories,
    memberships,
    issues,
    summary: {
      territories: territories.length,
      organizations: organizations.length,
      organizationTerritories: organizationTerritories.length,
      memberships: memberships.length,
      warnings: issues.length - blockingIssues.length,
      blockingIssues: blockingIssues.length,
      readyToApply: blockingIssues.length === 0,
    },
  };
}

async function loadLegacyProjection(db, options = {}) {
  const [countries, regions, franchises, users] = await Promise.all([
    db.Country.findAll({ raw: true }),
    db.Region.findAll({ raw: true }),
    db.Franchise.findAll({ raw: true }),
    db.User.findAll({ where: { role: 'admin' }, raw: true }),
  ]);

  return buildTerritorialProjection({
    countries,
    regions,
    franchises,
    users,
    headquartersName: options.headquartersName,
  });
}

async function upsertByCode(Model, data, transaction) {
  const [instance, created] = await Model.findOrCreate({
    where: { code: data.code },
    defaults: data,
    transaction,
  });
  if (!created) await instance.update(data, { transaction });
  return { instance, created };
}

async function applyTerritorialProjection(db, projection) {
  if (!projection?.summary?.readyToApply) {
    const error = new Error('Territorial projection contains blocking issues');
    error.code = 'TERRITORIAL_PROJECTION_BLOCKED';
    error.issues = projection?.issues || [];
    throw error;
  }

  return db.sequelize.transaction(async (transaction) => {
    const territoryIds = new Map();
    const organizationIds = new Map();
    const stats = { created: 0, updated: 0, assignments: 0, memberships: 0 };

    for (const projected of projection.territories) {
      const parentId = projected.parentCode
        ? territoryIds.get(projected.parentCode)
        : null;
      const { parentCode: _parentCode, ...data } = projected;
      const result = await upsertByCode(
        db.Territory,
        { ...data, parentId },
        transaction
      );
      territoryIds.set(projected.code, result.instance.id);
      stats[result.created ? 'created' : 'updated'] += 1;
    }

    const organizationOrder = {
      HEADQUARTERS: 0,
      MASTER: 1,
      REGIONAL: 2,
      PARTNER: 3,
    };
    const orderedOrganizations = [...projection.organizations].sort(
      (left, right) => organizationOrder[left.type] - organizationOrder[right.type]
    );

    for (const projected of orderedOrganizations) {
      const parentOrganizationId = projected.parentOrganizationCode
        ? organizationIds.get(projected.parentOrganizationCode)
        : null;
      const { parentOrganizationCode: _parentCode, ...data } = projected;
      const result = await upsertByCode(
        db.Organization,
        { ...data, parentOrganizationId },
        transaction
      );
      organizationIds.set(projected.code, result.instance.id);
      stats[result.created ? 'created' : 'updated'] += 1;
    }

    for (const assignment of projection.organizationTerritories) {
      const organizationId = organizationIds.get(assignment.organizationCode);
      const territoryId = territoryIds.get(assignment.territoryCode);
      const defaults = {
        isPrimary: assignment.isPrimary,
        isExclusive: assignment.isExclusive,
        status: assignment.status,
      };
      const [instance, created] = await db.OrganizationTerritory.findOrCreate({
        where: { organizationId, territoryId },
        defaults,
        transaction,
      });
      if (!created) await instance.update(defaults, { transaction });
      stats.assignments += 1;
    }

    for (const membership of projection.memberships) {
      const organizationId = organizationIds.get(membership.organizationCode);
      const territoryId = membership.territoryCode
        ? territoryIds.get(membership.territoryCode)
        : null;
      const where = {
        userId: membership.userId,
        organizationId,
        territoryId,
        roleKey: membership.roleKey,
      };
      const defaults = {
        permissions: membership.permissions,
        status: membership.status,
      };
      const [instance, created] = await db.Membership.findOrCreate({
        where,
        defaults,
        transaction,
      });
      if (!created) await instance.update(defaults, { transaction });
      stats.memberships += 1;
    }

    return stats;
  });
}

module.exports = {
  buildTerritorialProjection,
  loadLegacyProjection,
  applyTerritorialProjection,
  countryTerritoryCode,
  regionTerritoryCode,
  franchiseOrganizationCode,
};
