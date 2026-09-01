'use strict';

const { Op } = require('sequelize');
const {
  buildTerritoryWhere,
  preferMostSpecificAvailability,
} = require('../../src/controllers/serviceCatalog.controller');

describe('service catalog controller selection', () => {
  test('uses a regional offering with a country fallback', () => {
    const where = buildTerritoryWhere({ countryId: '2', regionId: '20' });
    expect(where[Op.or]).toEqual([
      { regionId: 20 },
      { type: 'COUNTRY', countryId: 2 },
    ]);
  });

  test('prefers the most specific offering for each definition', () => {
    const records = [
      { id: 1, serviceDefinitionId: 9, territory: { type: 'COUNTRY' } },
      { id: 2, serviceDefinitionId: 9, territory: { type: 'REGION' } },
      { id: 3, serviceDefinitionId: 10, territory: { type: 'COUNTRY' } },
    ];
    expect(preferMostSpecificAvailability(records).map(({ id }) => id)).toEqual([2, 3]);
  });
});
