'use strict';

const {
  resolveGeoModelDescriptor,
  buildGeoIntegrityQuery,
  summarizeGeoIntegrity,
  auditGeoIntegrity,
} = require('../../src/services/geoIntegrity.service');

function fakeModel(tableName, fields) {
  return {
    rawAttributes: Object.fromEntries(
      Object.entries(fields).map(([name, field]) => [name, { field }])
    ),
    getTableName: () => tableName,
  };
}

describe('geoIntegrity.service', () => {
  test('discovers physical geo columns from Sequelize metadata', () => {
    const descriptor = resolveGeoModelDescriptor(
      'Order',
      fakeModel('orders', { countryId: 'country_id', regionId: 'region_id' })
    );

    expect(descriptor).toEqual({
      modelName: 'Order',
      tableName: 'orders',
      countryColumn: 'country_id',
      regionColumn: 'region_id',
      category: 'operational',
      requiresCountry: true,
    });
  });

  test('builds a read-only aggregate query with quoted identifiers', () => {
    const sql = buildGeoIntegrityQuery({
      tableName: 'services',
      countryColumn: 'countryId',
      regionColumn: 'regionId',
    });

    expect(sql).toContain('FROM `services` t');
    expect(sql).toContain('LEFT JOIN `countries` c');
    expect(sql).toContain('LEFT JOIN `regions` r');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT|ALTER|DROP)\b/);
  });

  test('reports strict readiness only when required scopes are clean', () => {
    const clean = summarizeGeoIntegrity([
      {
        category: 'operational',
        requiresCountry: true,
        stats: {
          total: 4,
          missingCountry: 0,
          missingRegion: 0,
          regionWithoutCountry: 0,
          unknownCountry: 0,
          unknownRegion: 0,
          regionCountryMismatch: 0,
        },
      },
    ]);
    expect(clean.readyForStrictRegionScope).toBe(true);

    const impacted = summarizeGeoIntegrity([
      {
        category: 'operational',
        requiresCountry: true,
        stats: {
          total: 4,
          missingCountry: 1,
          missingRegion: 2,
          regionWithoutCountry: 1,
          unknownCountry: 0,
          unknownRegion: 0,
          regionCountryMismatch: 0,
        },
      },
    ]);
    expect(impacted).toMatchObject({
      missingRequiredCountry: 1,
      strictRegionVisibilityImpact: 1,
      blockingAnomalies: 1,
      readyForStrictRegionScope: false,
    });
  });

  test('audits every discovered model without mutating the database', async () => {
    const query = jest.fn().mockResolvedValue([
      [
        {
          total: '3',
          missingCountry: '0',
          missingRegion: '1',
          regionWithoutCountry: '0',
          unknownCountry: '0',
          unknownRegion: '0',
          regionCountryMismatch: '0',
        },
      ],
    ]);
    const db = {
      Service: fakeModel('services', {
        countryId: 'countryId',
        regionId: 'regionId',
      }),
      Country: fakeModel('countries', { isoCode: 'iso_code' }),
      sequelize: {
        query,
        getQueryInterface: () => ({
          showAllTables: jest.fn().mockResolvedValue(['services', 'countries']),
        }),
      },
    };

    const report = await auditGeoIntegrity(db);

    expect(query).toHaveBeenCalledTimes(1);
    expect(report.mode).toBe('read-only');
    expect(report.tables[0].stats.total).toBe(3);
    expect(report.summary.strictRegionVisibilityImpact).toBe(1);
  });

  test('skips additive models whose migration has not run yet', async () => {
    const query = jest.fn().mockResolvedValue([[{ total: '0' }]]);
    const showAllTables = jest.fn().mockResolvedValue(['services']);
    const queryInterface = { showAllTables };
    const db = {
      Service: fakeModel('services', {
        countryId: 'countryId',
        regionId: 'regionId',
      }),
      Organization: fakeModel('organizations', {
        countryId: 'country_id',
        regionId: 'region_id',
      }),
      sequelize: {
        query,
        getQueryInterface: () => queryInterface,
      },
    };

    const report = await auditGeoIntegrity(db);

    expect(query).toHaveBeenCalledTimes(1);
    expect(report.tables.map(({ tableName }) => tableName)).toEqual(['services']);
    expect(report.skippedTables).toEqual(['organizations']);
  });
});
