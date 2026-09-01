'use strict';

const {
  buildTerritorialProjection,
  applyTerritorialProjection,
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
