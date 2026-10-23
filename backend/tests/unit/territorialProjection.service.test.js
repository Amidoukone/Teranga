'use strict';

const {
  buildTerritorialProjection,
  applyTerritorialProjection,
  loadLegacyProjection,
} = require('../../src/services/territorialProjection.service');

function validLegacyData() {
  return {
    countries: [
      { id: 1, name: 'Mali', isoCode: 'ML', isActive: true },
    ],
    regions: [
      { id: 10, countryId: 1, name: 'Bamako', code: 'BKO', isActive: true },
    ],
    franchises: [
      {
        id: 101,
        type: 'REGIONAL',
        countryId: 1,
        regionId: 10,
        legalName: 'Teranga Bamako',
        status: 'active',
      },
      {
        id: 100,
        type: 'MASTER',
        countryId: 1,
        regionId: null,
        legalName: 'Teranga Mali',
        status: 'active',
      },
    ],
    users: [
      { id: 1, role: 'admin', countryId: null, regionId: null },
      { id: 2, role: 'admin', countryId: 1, regionId: null },
      { id: 3, role: 'admin', countryId: 1, regionId: 10 },
      { id: 4, role: 'client', countryId: 1, regionId: 10 },
    ],
  };
}

describe('territorialProjection service', () => {
  function sourceDb(data) {
    return Object.fromEntries([
      ['Country', data.countries], ['Region', data.regions],
      ['Franchise', data.franchises], ['User', data.users],
    ].map(([model, rows]) => [model, { findAll: jest.fn().mockResolvedValue(rows) }]));
  }

  test('prepares Mali independently of a country whose operator is missing', async () => {
    const data = validLegacyData();
    data.countries.push({ id: 2, name: 'Other country', isoCode: 'CI', isActive: true });
    data.users.push({ id: 23, role: 'admin', countryId: 2, regionId: null });
    const db = sourceDb(data);
    expect((await loadLegacyProjection(db)).summary.readyToApply).toBe(false);
    const plan = await loadLegacyProjection(db, { countryCode: 'ML' });
    expect(plan.summary.readyToApply).toBe(true);
    expect(plan.territories.map((row) => row.countryId)).toEqual([1, 1]);
    expect(plan.memberships.map((row) => row.userId)).toEqual([1, 2, 3]);
    expect(plan.organizations.map((row) => row.code).sort()).toEqual(['LEGACY:FRANCHISE:100', 'LEGACY:FRANCHISE:101', 'TERANGA-HQ']);
    await expect(loadLegacyProjection(db, { countryCode: 'SN' })).rejects.toThrow('not found: SN');
  });

  test('retains missing operators and incoherent regional records as local blockers', async () => {
    const data = validLegacyData();
    data.franchises = [];
    const plan = await loadLegacyProjection(sourceDb(data), { countryCode: 'ML' });
    expect(plan.summary.readyToApply).toBe(false);
    expect(plan.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'COUNTRY_ADMIN_SCOPE_AMBIGUOUS' })]));
    data.franchises = [{ id: 101, type: 'REGIONAL', countryId: 2, regionId: 10 }];
    const incoherent = await loadLegacyProjection(sourceDb(data), { countryCode: 'ML' });
    expect(incoherent.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FRANCHISE_WITH_UNKNOWN_COUNTRY', entityId: 101 }),
    ]));
  });

  test('builds stable territories, organizations and admin memberships', () => {
    const projection = buildTerritorialProjection(validLegacyData());

    expect(projection.summary).toEqual({
      territories: 2,
      organizations: 3,
      organizationTerritories: 2,
      memberships: 3,
      warnings: 0,
      blockingIssues: 0,
      readyToApply: true,
    });
    expect(projection.territories.map(({ code }) => code)).toEqual([
      'LEGACY:COUNTRY:1',
      'LEGACY:REGION:10',
    ]);
    expect(
      projection.organizations.find(({ code }) => code === 'LEGACY:FRANCHISE:101')
    ).toEqual(
      expect.objectContaining({
        type: 'REGIONAL',
        parentOrganizationCode: 'LEGACY:FRANCHISE:100',
      })
    );
    expect(projection.memberships.map(({ roleKey }) => roleKey)).toEqual([
      'global_admin',
      'country_admin',
      'regional_admin',
    ]);
  });

  test('projects the country time zone to its territory', () => {
    const data = validLegacyData();
    data.countries[0].timezone = 'Africa/Bamako';
    const projection = buildTerritorialProjection(data);
    expect(projection.territories[0].timezone).toBe('Africa/Bamako');
    expect(projection.territories[1].timezone).toBe('Africa/Bamako');
    data.regions[0].timezone = 'Africa/Abidjan';
    expect(buildTerritorialProjection(data).territories[1].timezone).toBe('Africa/Abidjan');
  });

  test('does not guess when two organizations match an administrator scope', () => {
    const data = validLegacyData();
    data.franchises.push({
      ...data.franchises[0],
      id: 102,
      legalName: 'Autre franchise Bamako',
    });

    const projection = buildTerritorialProjection(data);

    expect(projection.summary.readyToApply).toBe(false);
    expect(projection.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'blocking',
          code: 'REGIONAL_ADMIN_SCOPE_AMBIGUOUS',
          entityId: 3,
        }),
      ])
    );
    expect(projection.memberships).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: 3 })])
    );
  });

  test('blocks a regional franchise whose region belongs to another country', () => {
    const data = validLegacyData();
    data.countries.push({ id: 2, name: 'Sénégal', isoCode: 'SN', isActive: true });
    data.franchises[0].countryId = 2;

    const projection = buildTerritorialProjection(data);

    expect(projection.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'blocking',
          code: 'REGIONAL_FRANCHISE_SCOPE_INCOHERENT',
          entityId: 101,
        }),
      ])
    );
  });

  test('refuses every write when the projection contains a blocking issue', async () => {
    const db = { sequelize: { transaction: jest.fn() } };
    const projection = buildTerritorialProjection({
      users: [{ id: 9, role: 'admin', countryId: 99, regionId: null }],
    });

    await expect(applyTerritorialProjection(db, projection)).rejects.toMatchObject({
      code: 'TERRITORIAL_PROJECTION_BLOCKED',
    });
    expect(db.sequelize.transaction).not.toHaveBeenCalled();
  });
});
