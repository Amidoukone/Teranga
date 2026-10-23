'use strict';

const {
  buildCatalogProjection,
  applyCatalogProjection,
  loadCatalogProjection,
} = require('../../src/services/serviceCatalogProjection.service');

function validSource() {
  return {
    tradeCategories: [
      { id: 10, name: 'Plomberie', slug: 'plomberie', isActive: true },
      { id: 11, name: 'Taxi', slug: 'mobilite', isActive: true },
    ],
    countries: [{ id: 1, name: 'Mali', isoCode: 'ML', currency: 'XOF', isActive: true }],
    territories: [
      { id: 100, type: 'COUNTRY', countryId: 1, regionId: null, isActive: true },
    ],
    organizations: [{ id: 200, status: 'active', type: 'MASTER' }],
    organizationTerritories: [
      { organizationId: 200, territoryId: 100, status: 'active', isPrimary: 1 },
    ],
  };
}

describe('service catalog projection', () => {
  function sourceDb(data) {
    return Object.fromEntries([
      ['Country', data.countries], ['Territory', data.territories],
      ['Organization', data.organizations], ['OrganizationTerritory', data.organizationTerritories],
      ['TradeCategory', data.tradeCategories],
    ].map(([model, rows]) => [model, { findAll: jest.fn().mockResolvedValue(rows) }]));
  }

  test('excludes foreign offerings and blockers from a country-scoped projection', async () => {
    const data = validSource();
    data.countries.push({ id: 2, name: 'Other country', isoCode: 'CI', currency: 'XOF', isActive: true });
    data.territories.push({ id: 101, type: 'COUNTRY', countryId: 2, isActive: true });
    data.tradeCategories.push({ id: 12, name: 'Foreign trade', slug: 'foreign', countryId: 2, isActive: true });
    const db = sourceDb(data);
    expect((await loadCatalogProjection(db)).summary.readyToApply).toBe(false);
    const plan = await loadCatalogProjection(db, { countryCode: 'ML' });
    expect(plan.summary.readyToApply).toBe(true);
    expect(plan.definitions.some((row) => row.code === 'TRADE:FOREIGN')).toBe(false);
    expect(plan.availabilities).toHaveLength(7);
    expect(plan.availabilities.every((row) => row.territoryId === 100 && row.organizationId === 200)).toBe(true);
    await expect(loadCatalogProjection(db, { countryCode: 'SN' })).rejects.toThrow('not found: SN');
  });

  test('retains local categories whose regional territory is missing as blockers', async () => {
    const data = validSource();
    data.tradeCategories.push({ id: 12, name: 'Regional trade', slug: 'regional', countryId: 1, regionId: 999, isActive: true });
    const plan = await loadCatalogProjection(sourceDb(data), { countryCode: 'ML' });
    expect(plan.summary.readyToApply).toBe(false);
    expect(plan.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CATALOG_DEFINITION_WITHOUT_TERRITORY', entityId: 'TRADE:REGIONAL' }),
    ]));
  });

  test('projects global and classic offerings into the operated country', () => {
    const projection = buildCatalogProjection(validSource());

    expect(projection.summary).toEqual({
      definitions: 7,
      availabilities: 7,
      warnings: 0,
      blockingIssues: 0,
      readyToApply: true,
    });
    expect(projection.definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TRADE:MOBILITE',
          executionProfile: 'mobility',
          family: 'frequency',
        }),
        expect.objectContaining({
          code: 'CLASSIC:ADMINISTRATIVE',
          executionProfile: 'agent',
        }),
      ])
    );
    expect(projection.availabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          definitionCode: 'TRADE:PLOMBERIE',
          territoryId: 100,
          organizationId: 200,
          currency: 'XOF',
        }),
      ])
    );
  });

  test('does not guess the operator when a territory is ambiguous', () => {
    const source = validSource();
    source.organizations.push({ id: 201, status: 'active', type: 'PARTNER' });
    source.organizationTerritories.push({
      organizationId: 201,
      territoryId: 100,
      status: 'active',
      isPrimary: 1,
    });

    const projection = buildCatalogProjection(source);
    expect(projection.summary.readyToApply).toBe(false);
    expect(projection.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CATALOG_TERRITORY_OPERATOR_AMBIGUOUS',
          entityId: 100,
        }),
      ])
    );
  });

  test('uses the local currency and blocks a country without one', () => {
    const source = validSource();
    source.countries[0].currency = 'GHS';
    expect(buildCatalogProjection(source).availabilities.every((item) => item.currency === 'GHS')).toBe(true);

    source.countries[0].currency = null;
    const projection = buildCatalogProjection(source);
    expect(projection.summary.readyToApply).toBe(false);
    expect(projection.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CATALOG_COUNTRY_CURRENCY_MISSING' }),
    ]));
  });

  test('prepares offerings for an inactive country before launch', () => {
    const source = validSource();
    source.countries[0].isActive = false;
    source.territories[0].isActive = false;
    const projection = buildCatalogProjection(source);
    expect(projection.availabilities).toHaveLength(7);
    expect(projection.availabilities.every((item) => item.isActive === false)).toBe(true);
    expect(projection.summary.readyToApply).toBe(true);
  });

  test('refuses all writes while the catalog projection has blocking issues', async () => {
    const db = { sequelize: { transaction: jest.fn() } };
    const projection = buildCatalogProjection({
      tradeCategories: [{ id: 1, name: 'Taxi', slug: 'mobilite', isActive: true }],
    });

    await expect(applyCatalogProjection(db, projection)).rejects.toMatchObject({
      code: 'SERVICE_CATALOG_PROJECTION_BLOCKED',
    });
    expect(db.sequelize.transaction).not.toHaveBeenCalled();
  });

  test('does not overwrite a configured local offering on a repeated projection', async () => {
    const existingOffering = { id: 7, basePrice: 500, currency: 'GHS', update: jest.fn() };
    const db = {
      sequelize: { transaction: jest.fn((run) => run('tx')) },
      ServiceDefinition: { findOrCreate: jest.fn().mockResolvedValue([{ id: 9, update: jest.fn() }, false]) },
      ServiceAvailability: { findOrCreate: jest.fn().mockResolvedValue([existingOffering, false]) },
    };
    const projection = {
      summary: { readyToApply: true },
      definitions: [{ code: 'TRADE:TEST', name: 'Test' }],
      availabilities: [{ definitionCode: 'TRADE:TEST', territoryId: 1, organizationId: 2, currency: 'GHS', basePrice: null }],
    };
    const stats = await applyCatalogProjection(db, projection);
    expect(existingOffering.update).not.toHaveBeenCalled();
    expect(stats.availabilitiesExisting).toBe(1);
  });
});
