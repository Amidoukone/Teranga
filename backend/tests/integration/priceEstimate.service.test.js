'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const db = require('../../models');
const { estimateMission } = require('../../src/services/priceEstimate.service');

let dbReady = false;
const created = {
  countryIds: [],
  regionIds: [],
  tradeCategoryIds: [],
  ruleIds: [],
};

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    return true;
  } catch (_err) {
    return false;
  }
}

async function makeCountry(currency) {
  const iso = Math.random().toString(36).slice(2, 4).toUpperCase();
  const country = await db.Country.create({
    name: `PriceEstimate-${Date.now()}-${iso}`,
    isoCode: iso,
    currency,
    isActive: true,
  });
  created.countryIds.push(country.id);
  return country;
}

async function makeRegion(countryId) {
  const region = await db.Region.create({
    name: `PriceEstimate-Region-${Date.now()}`,
    code: `R${Date.now()}`,
    countryId,
    isActive: true,
  });
  created.regionIds.push(region.id);
  return region;
}

async function makeTradeCategory() {
  const slug = `priceestimate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tc = await db.TradeCategory.create({ name: `Filiere ${slug}`, slug, isActive: true });
  created.tradeCategoryIds.push(tc.id);
  return tc;
}

async function makeRule(overrides) {
  const rule = await db.MissionPricingRule.create({
    regionId: null,
    tradeCategoryId: null,
    serviceType: null,
    pricingMode: 'fixed_estimate',
    pricePerKm: 0,
    priceIncrement: 0,
    estimatedDelayMinutes: 60,
    isActive: true,
    ...overrides,
  });
  created.ruleIds.push(rule.id);
  return rule;
}

describe('priceEstimate.service.estimateMission', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (!dbReady) return;
    if (created.ruleIds.length) await db.MissionPricingRule.destroy({ where: { id: created.ruleIds } });
    if (created.tradeCategoryIds.length) {
      await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
    }
    if (created.regionIds.length) await db.Region.destroy({ where: { id: created.regionIds } });
    if (created.countryIds.length) await db.Country.destroy({ where: { id: created.countryIds } });
    await db.sequelize.close();
  });

  test('returns a quote_only response when the user has no country scope', async () => {
    if (!dbReady) return;
    const result = await estimateMission({
      user: { countryId: null, regionId: null },
      executionType: 'agent',
      serviceType: 'errand',
    });
    expect(result.pricingMode).toBe('quote_only');
    expect(result.basePrice).toBeNull();
  });

  test('falls back to the generic country rule when no category-specific rule exists', async () => {
    if (!dbReady) return;
    const country = await makeCountry('GHS');
    await makeRule({ countryId: country.id, pricingMode: 'quote_only', estimatedDelayMinutes: 90 });

    const result = await estimateMission({
      user: { countryId: country.id, regionId: null },
      executionType: 'agent',
      serviceType: 'payment',
    });

    expect(result.pricingMode).toBe('quote_only');
    expect(result.currency).toBe('GHS');
    expect(result.estimatedDelayMinutes).toBe(90);
  });

  test('prefers a category-specific fixed_estimate rule over the generic fallback', async () => {
    if (!dbReady) return;
    const country = await makeCountry('XOF');
    const tradeCategory = await makeTradeCategory();
    await makeRule({ countryId: country.id, pricingMode: 'quote_only', estimatedDelayMinutes: 120 });
    await makeRule({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      pricingMode: 'fixed_estimate',
      basePrice: 7500,
      estimatedDelayMinutes: 90,
    });

    const result = await estimateMission({
      user: { countryId: country.id, regionId: null },
      executionType: 'provider',
      tradeCategoryId: tradeCategory.id,
    });

    expect(result.pricingMode).toBe('fixed_estimate');
    expect(result.basePrice).toBe(7500);
    expect(result.estimatedDelayMinutes).toBe(90);
  });

  test('prefers a vehicle-specific mobility rule and falls back to the shared rule', async () => {
    if (!dbReady) return;
    const country = await makeCountry('XOF');
    const tradeCategory = await makeTradeCategory();
    await makeRule({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      basePrice: 1500,
    });
    await makeRule({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      vehicleType: 'car',
      basePrice: 3000,
    });

    const car = await estimateMission({
      user: { countryId: country.id, regionId: null },
      executionType: 'provider',
      tradeCategoryId: tradeCategory.id,
      requestedVehicleType: 'car',
    });
    const motorcycle = await estimateMission({
      user: { countryId: country.id, regionId: null },
      executionType: 'provider',
      tradeCategoryId: tradeCategory.id,
      requestedVehicleType: 'motorcycle',
    });

    expect(car.basePrice).toBe(3000);
    expect(motorcycle.basePrice).toBe(1500);
  });

  test('prefers a delivery package rule and rounds the distance price to a simple step', async () => {
    if (!dbReady) return;
    const country = await makeCountry('XOF');
    const tradeCategory = await makeTradeCategory();
    await makeRule({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      basePrice: 1500,
      pricePerKm: 0,
    });
    await makeRule({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      packageType: 'standard',
      basePrice: 2000,
      pricePerKm: 300,
      priceIncrement: 500,
    });

    const result = await estimateMission({
      user: { countryId: country.id, regionId: null },
      executionType: 'provider',
      tradeCategoryId: tradeCategory.id,
      packageType: 'standard',
      pickupLatitude: 12.6392,
      pickupLongitude: -8.0029,
      destinationLatitude: 12.6205,
      destinationLongitude: -7.9895,
    });

    expect(result.basePrice).toBeGreaterThan(2000);
    expect(result.basePrice % 500).toBe(0);
    expect(result.priceIncrement).toBe(500);
  });

  test('prefers a region-specific override over the country-wide rule for the same category', async () => {
    if (!dbReady) return;
    const country = await makeCountry('XOF');
    const region = await makeRegion(country.id);
    const tradeCategory = await makeTradeCategory();

    await makeRule({
      countryId: country.id,
      tradeCategoryId: tradeCategory.id,
      pricingMode: 'fixed_estimate',
      basePrice: 7500,
      estimatedDelayMinutes: 90,
    });
    await makeRule({
      countryId: country.id,
      regionId: region.id,
      tradeCategoryId: tradeCategory.id,
      pricingMode: 'fixed_estimate',
      basePrice: 9000,
      estimatedDelayMinutes: 75,
    });

    const result = await estimateMission({
      user: { countryId: country.id, regionId: region.id },
      executionType: 'provider',
      tradeCategoryId: tradeCategory.id,
    });

    expect(result.basePrice).toBe(9000);
    expect(result.estimatedDelayMinutes).toBe(75);
  });

  test('returns an ultimate quote_only fallback when the country has zero rules', async () => {
    if (!dbReady) return;
    const country = await makeCountry('EUR');

    const result = await estimateMission({
      user: { countryId: country.id, regionId: null },
      executionType: 'agent',
      serviceType: 'other',
    });

    expect(result.pricingMode).toBe('quote_only');
    expect(result.currency).toBe('EUR');
  });
});
