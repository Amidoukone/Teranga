'use strict';

const {
  buildCatalogProjection,
  applyCatalogProjection,
} = require('../../src/services/serviceCatalogProjection.service');

function validSource() {
  return {
    tradeCategories: [
      { id: 10, name: 'Plomberie', slug: 'plomberie', isActive: true },
      { id: 11, name: 'Taxi', slug: 'mobilite', isActive: true },
    ],
    countries: [{ id: 1, name: 'Mali', currency: 'XOF', isActive: true }],
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
});
