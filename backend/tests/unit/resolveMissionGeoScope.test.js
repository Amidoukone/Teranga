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
    resolveGeoScope.mockResolvedValue({ countryId: 1, regionId: 2, countryIso: 'ML' });
    countryHasActiveMaster.mockResolvedValue(true);
    const result = await resolveMissionGeoScope({
      countryIso: null,
      adminAreaName: null,
      fallbackCountryId: 1,
      fallbackRegionId: 2,
    });

    expect(result).toEqual({ countryId: 1, regionId: 2 });
    expect(resolveGeoScope).toHaveBeenCalledWith({ countryId: 1, regionId: 2 });
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
    test('rejects a destination outside the country of a scoped trade category', async () => {
      resolveGeoScope.mockResolvedValue({ countryId: 5, regionId: 12, countryIso: 'ML' });
      countryHasActiveMaster.mockResolvedValue(true);

      const result = await resolveMissionGeoScope({
        countryIso: 'CI', // adresse géocodée dans un tout autre pays
        adminAreaName: 'Lagunes',
        fallbackCountryId: 1,
        fallbackRegionId: 2,
        tradeCategoryScope: { countryId: 5, regionId: 12 },
      });

      expect(result).toEqual({ error: 'La destination ne correspond pas au pays de cette filière.' });
      expect(resolveGeoScope).toHaveBeenCalledWith({ countryId: 5, regionId: 12 });
      expect(Region.findAll).not.toHaveBeenCalled();
      expect(countryHasActiveMaster).not.toHaveBeenCalled();
    });

    test('takes priority even when no address was geocoded at all', async () => {
      resolveGeoScope.mockResolvedValue({ countryId: 5, regionId: null, countryIso: 'ML' });
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
      resolveGeoScope.mockResolvedValue({ countryId: 5, regionId: null, countryIso: 'ML' });
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

    test('does not route a scoped category into an inactive country', async () => {
      resolveGeoScope.mockResolvedValue({ error: 'Pays invalide ou non supporté' });
      const result = await resolveMissionGeoScope({
        countryIso: null,
        tradeCategoryScope: { countryId: 5, regionId: null },
      });
      expect(result).toEqual({ error: 'Pays invalide ou non supporté' });
      expect(countryHasActiveMaster).not.toHaveBeenCalled();
    });
  });

  test('does not route a locationless mission into an inactive account country', async () => {
    resolveGeoScope.mockResolvedValue({ error: 'Pays invalide ou non supporté' });
    const result = await resolveMissionGeoScope({
      countryIso: null, fallbackCountryId: 5, fallbackRegionId: null,
    });
    expect(result).toEqual({ error: 'Pays invalide ou non supporté' });
  });

  test('uses an explicitly selected foreign country and region for a locationless mission', async () => {
    resolveGeoScope.mockResolvedValue({ countryId: 3, regionId: 42, countryIso: 'CI' });
    countryHasActiveMaster.mockResolvedValue(true);
    const result = await resolveMissionGeoScope({
      countryIso: null,
      fallbackCountryId: 1,
      fallbackRegionId: 2,
      selectedCountryId: 3,
      selectedRegionId: 42,
    });
    expect(result).toEqual({ countryId: 3, regionId: 42 });
    expect(resolveGeoScope).toHaveBeenCalledWith({ countryId: 3, regionId: 42 });
  });

  test('rejects a destination in another country than the selected execution country', async () => {
    resolveGeoScope.mockImplementation(async (scope) => scope.countryId
      ? { countryId: 3, regionId: null, countryIso: 'CI' }
      : { countryId: 1, regionId: null, countryIso: 'ML' });
    const result = await resolveMissionGeoScope({
      countryIso: 'ML',
      selectedCountryId: 3,
    });
    expect(result).toEqual({ error: 'La destination ne correspond pas au pays sélectionné.' });
  });

  test('rejects an inactive selected region before routing a mission', async () => {
    resolveGeoScope.mockResolvedValue({ error: 'Région inactive' });
    const result = await resolveMissionGeoScope({
      countryIso: null,
      selectedCountryId: 3,
      selectedRegionId: 42,
    });
    expect(result).toEqual({ error: 'Région inactive' });
  });

  test('rejects a recognized destination region that differs from the selected region', async () => {
    resolveGeoScope.mockResolvedValue({ countryId: 3, regionId: 42, countryIso: 'CI' });
    Region.findAll.mockResolvedValue([{ id: 43, name: 'Bouaké' }]);
    const result = await resolveMissionGeoScope({
      countryIso: 'CI',
      adminAreaName: 'Bouaké',
      selectedCountryId: 3,
      selectedRegionId: 42,
      tradeCategoryScope: { countryId: 3, regionId: null },
    });
    expect(result).toEqual({ error: 'La destination ne correspond pas à la région sélectionnée.' });
  });
});
