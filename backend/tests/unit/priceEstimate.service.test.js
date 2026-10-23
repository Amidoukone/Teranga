'use strict';

jest.mock('../../models', () => ({
  Country: { findByPk: jest.fn() },
  MissionPricingRule: { findOne: jest.fn() },
}));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn() }));

const { Country, MissionPricingRule } = require('../../models');
const { estimateMission } = require('../../src/services/priceEstimate.service');

beforeEach(() => {
  jest.resetAllMocks();
  Country.findByPk.mockResolvedValue({ currency: 'GHS' });
  MissionPricingRule.findOne.mockResolvedValue(null);
});

test('an explicit foreign country uses national rules without the account region', async () => {
  const result = await estimateMission({
    user: { countryId: 1, regionId: 10 },
    countryId: 2, executionType: 'agent', serviceType: 'errand',
  });
  expect(result.currency).toBe('GHS');
  expect(MissionPricingRule.findOne).toHaveBeenCalled();
  for (const [query] of MissionPricingRule.findOne.mock.calls) {
    expect(query.where).toEqual(expect.objectContaining({ countryId: 2, regionId: null }));
  }
});

test('null region explicitly selects national rules even in the account country', async () => {
  await estimateMission({
    user: { countryId: 2, regionId: 20 },
    countryId: 2, regionId: null, executionType: 'agent', serviceType: 'errand',
  });
  expect(MissionPricingRule.findOne.mock.calls.every(([query]) => query.where.regionId === null)).toBe(true);
});

test('the account region remains the default when no destination was specified', async () => {
  await estimateMission({ user: { countryId: 2, regionId: 20 }, executionType: 'agent', serviceType: 'errand' });
  expect(MissionPricingRule.findOne.mock.calls[0][0].where.regionId).toBe(20);
});

test('a pricing failure retains the destination currency for the manual quote', async () => {
  MissionPricingRule.findOne.mockRejectedValue(new Error('Pricing temporarily unavailable'));
  const result = await estimateMission({ countryId: 2, executionType: 'agent', serviceType: 'errand' });
  expect(result).toEqual(expect.objectContaining({ pricingMode: 'quote_only', currency: 'GHS', basePrice: null }));
});
