'use strict';

jest.mock('../../models', () => ({
  Region: { findAll: jest.fn() },
}));

jest.mock('../../src/controllers/auth.controller', () => ({
  resolveGeoScope: jest.fn(),
  countryHasActiveMaster: jest.fn(),
}));

const { Region } = require('../../models');
const { resolveGeoScope, countryHasActiveMaster } = require('../../src/controllers/auth.controller');
const { resolveMissionGeoScope } = require('../../src/utils/resolveMissionGeoScope');

describe('resolveMissionGeoScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('falls back to account scope when no countryIso is provided (mission without location)', async () => {
    const result = await resolveMissionGeoScope({
      countryIso: null,
      adminAreaName: null,
      fallbackCountryId: 1,
      fallbackRegionId: 2,
    });

    expect(result).toEqual({ countryId: 1, regionId: 2 });
    expect(resolveGeoScope).not.toHaveBeenCalled();
  });

  test('resolves the destination country from a geocoded ISO, ignoring the account scope', async () => {
    resolveGeoScope.mockResolvedValue({ countryId: 3, countryIso: 'CI' });
    countryHasActiveMaster.mockResolvedValue(true);
    Region.findAll.mockResolvedValue([{ id: 42, name: 'Lagunes' }]);

    const result = await resolveMissionGeoScope({
      countryIso: 'CI',
      adminAreaName: 'Lagunes',
      fallbackCountryId: 1, // pays du compte (Mali) — ne doit pas être utilisé
      fallbackRegionId: 2,
    });

    expect(resolveGeoScope).toHaveBeenCalledWith({ country: 'CI' });
    expect(countryHasActiveMaster).toHaveBeenCalledWith(3);
    expect(result).toEqual({ countryId: 3, regionId: 42 });
  });

  test('resolves the region via normalized/fuzzy match when Google\'s name does not match exactly', async () => {
    resolveGeoScope.mockResolvedValue({ countryId: 3, countryIso: 'ML' });
    countryHasActiveMaster.mockResolvedValue(true);
    Region.findAll.mockResolvedValue([{ id: 7, name: 'Kayes' }, { id: 8, name: 'Ségou' }]);

    const result = await resolveMissionGeoScope({
      countryIso: 'ML',
      adminAreaName: 'Région de Kayes',
      fallbackCountryId: null,
      fallbackRegionId: null,
    });

    expect(result).toEqual({ countryId: 3, regionId: 7 });
  });

  test('region stays null (best-effort) when no adminAreaName or no match found', async () => {
    resolveGeoScope.mockResolvedValue({ countryId: 3, countryIso: 'CI' });
    countryHasActiveMaster.mockResolvedValue(true);

    const result = await resolveMissionGeoScope({
      countryIso: 'CI',
      adminAreaName: null,
      fallbackCountryId: 1,
      fallbackRegionId: 2,
    });

    expect(Region.findAll).not.toHaveBeenCalled();
    expect(result).toEqual({ countryId: 3, regionId: null });
  });

  test('returns an error when the geocoded country is not supported', async () => {
    resolveGeoScope.mockResolvedValue({ error: 'Pays invalide ou non supporté' });

    const result = await resolveMissionGeoScope({
      countryIso: 'ZZ',
      adminAreaName: null,
      fallbackCountryId: 1,
      fallbackRegionId: 2,
    });

    expect(result).toEqual({ error: 'Pays invalide ou non supporté' });
    expect(countryHasActiveMaster).not.toHaveBeenCalled();
  });

  test('returns an error when the destination country has no active master', async () => {
    resolveGeoScope.mockResolvedValue({ countryId: 9 });
    countryHasActiveMaster.mockResolvedValue(false);

    const result = await resolveMissionGeoScope({
      countryIso: 'FR',
      adminAreaName: null,
      fallbackCountryId: 1,
      fallbackRegionId: 2,
    });

    expect(result).toEqual({
      error: 'Nos services ne sont pas disponibles pour le moment dans ce pays.',
    });
  });

  describe('tradeCategoryScope (filière scopée pays/région)', () => {
    test('takes priority over geocoding entirely when the trade category is scoped to a region', async () => {
      countryHasActiveMaster.mockResolvedValue(true);

      const result = await resolveMissionGeoScope({
        countryIso: 'CI', // adresse géocodée dans un tout autre pays
        adminAreaName: 'Lagunes',
        fallbackCountryId: 1,
        fallbackRegionId: 2,
        tradeCategoryScope: { countryId: 5, regionId: 12 },
      });

      expect(result).toEqual({ countryId: 5, regionId: 12 });
      expect(resolveGeoScope).not.toHaveBeenCalled();
      expect(Region.findAll).not.toHaveBeenCalled();
      expect(countryHasActiveMaster).toHaveBeenCalledWith(5);
    });

    test('takes priority even when no address was geocoded at all', async () => {
      countryHasActiveMaster.mockResolvedValue(true);

      const result = await resolveMissionGeoScope({
        countryIso: null,
        adminAreaName: null,
        fallbackCountryId: 1,
        fallbackRegionId: 2,
        tradeCategoryScope: { countryId: 5, regionId: null },
      });

      expect(result).toEqual({ countryId: 5, regionId: null });
    });

    test('is ignored (falls through to geocoding) when the trade category is global (countryId null)', async () => {
      resolveGeoScope.mockResolvedValue({ countryId: 3, countryIso: 'CI' });
      countryHasActiveMaster.mockResolvedValue(true);
      Region.findAll.mockResolvedValue([{ id: 42, name: 'Lagunes' }]);

      const result = await resolveMissionGeoScope({
        countryIso: 'CI',
        adminAreaName: 'Lagunes',
        fallbackCountryId: 1,
        fallbackRegionId: 2,
        tradeCategoryScope: { countryId: null, regionId: null },
      });

      expect(resolveGeoScope).toHaveBeenCalledWith({ country: 'CI' });
      expect(result).toEqual({ countryId: 3, regionId: 42 });
    });

    test('still returns an error if the scoped trade category\'s country has no active master', async () => {
      countryHasActiveMaster.mockResolvedValue(false);

      const result = await resolveMissionGeoScope({
        countryIso: null,
        adminAreaName: null,
        tradeCategoryScope: { countryId: 5, regionId: null },
      });

      expect(result).toEqual({
        error: 'Nos services ne sont pas disponibles pour le moment dans ce pays.',
      });
    });
  });
});
