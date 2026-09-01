'use strict';

jest.mock('../../models', () => ({
  Country: { findByPk: jest.fn(), findOne: jest.fn() },
  Region: { findByPk: jest.fn() },
}));

const { Op } = require('sequelize');
const {
  applyGeoScope,
  canAccessGeoResource,
} = require('../../src/utils/geoScope');
const {
  parseBooleanFlag,
  isStrictRegionScopeEnabled,
} = require('../../src/utils/geoScopePolicy');

describe('geoScopePolicy', () => {
  const regionalAdmin = {
    id: 10,
    role: 'admin',
    countryId: 1,
    regionId: 2,
  };

  const previousFlag = process.env.GEO_SCOPE_STRICT_MODE;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.GEO_SCOPE_STRICT_MODE;
    else process.env.GEO_SCOPE_STRICT_MODE = previousFlag;
  });

  test.each([
    ['true', true],
    ['1', true],
    ['on', true],
    ['false', false],
    ['0', false],
    [undefined, false],
  ])('parseBooleanFlag(%p) returns %p', (value, expected) => {
    expect(parseBooleanFlag(value)).toBe(expected);
  });

  test('keeps the legacy country fallback by default', () => {
    expect(
      canAccessGeoResource(
        { id: 5, countryId: 1, regionId: null },
        regionalAdmin
      )
    ).toBe(true);

    const where = applyGeoScope({ status: 'created' }, regionalAdmin);
    expect(where.status).toBe('created');
    expect(where[Op.and]).toEqual([
      { [Op.or]: [{ regionId: 2 }, { regionId: null, countryId: 1 }] },
    ]);
  });

  test('strict mode excludes resources without the exact region', () => {
    const options = { strictRegionScope: true };

    expect(
      canAccessGeoResource(
        { id: 5, countryId: 1, regionId: null },
        regionalAdmin,
        options
      )
    ).toBe(false);
    expect(
      canAccessGeoResource(
        { id: 6, countryId: 1, regionId: 2 },
        regionalAdmin,
        options
      )
    ).toBe(true);
    expect(applyGeoScope({ status: 'created' }, regionalAdmin, options)).toEqual(
      { status: 'created', regionId: 2 }
    );
  });

  test('the environment flag enables strict mode without changing callers', () => {
    process.env.GEO_SCOPE_STRICT_MODE = 'true';

    expect(isStrictRegionScopeEnabled()).toBe(true);
    expect(
      canAccessGeoResource(
        { id: 5, countryId: 1, regionId: null },
        regionalAdmin
      )
    ).toBe(false);
  });

  test('country scoped and global admins keep their established behavior', () => {
    const countryAdmin = { role: 'admin', countryId: 1, regionId: null };
    const globalAdmin = { role: 'admin', countryId: null, regionId: null };

    expect(
      canAccessGeoResource(
        { countryId: 1, regionId: 99 },
        countryAdmin,
        { strictRegionScope: true }
      )
    ).toBe(true);
    expect(
      canAccessGeoResource(
        { countryId: 9, regionId: 99 },
        globalAdmin,
        { strictRegionScope: true }
      )
    ).toBe(true);
  });
});

