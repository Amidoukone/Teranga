'use strict';

jest.mock('../../models', () => ({ Country: { findByPk: jest.fn() }, Region: { findByPk: jest.fn() } }));
const { Country, Region } = require('../../models');
const { resolveAssistancePhone } = require('../../src/services/missionSafety.service');
const previous = process.env.TERANGA_ASSISTANCE_PHONE;
beforeEach(() => {
  jest.resetAllMocks();
  process.env.TERANGA_ASSISTANCE_PHONE = '+22370668364';
});
afterAll(() => {
  if (previous === undefined) delete process.env.TERANGA_ASSISTANCE_PHONE;
  else process.env.TERANGA_ASSISTANCE_PHONE = previous;
});

test('uses the region contact only when it belongs to the service country', async () => {
  Region.findByPk.mockResolvedValue({ countryId: 5, contactPhone: '+22370668364' });
  Country.findByPk.mockResolvedValue({ contactPhone: '+2250700000000' });
  expect(await resolveAssistancePhone({ countryId: 4, regionId: 10 })).toBe('+2250700000000');
  expect(await resolveAssistancePhone({ countryId: 5, regionId: 10 })).toBe('+22370668364');
});

test('can derive the country from a legacy regional service', async () => {
  Region.findByPk.mockResolvedValue({ countryId: 5, contactPhone: null });
  Country.findByPk.mockResolvedValue({ contactPhone: '+22370668364' });
  expect(await resolveAssistancePhone({ regionId: 10 })).toBe('+22370668364');
  expect(Country.findByPk).toHaveBeenCalledWith(5, expect.any(Object));
});

test('never substitutes a global phone for missing local assistance', async () => {
  Country.findByPk.mockResolvedValue({ contactPhone: null });
  expect(await resolveAssistancePhone({ countryId: 4 })).toBeNull();
  expect(await resolveAssistancePhone({})).toBeNull();
});
