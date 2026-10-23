'use strict';

jest.mock('../../models', () => ({
  Country: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Region: { findAll: jest.fn(async () => []) },
  Territory: { update: jest.fn() },
  sequelize: { transaction: jest.fn(async (callback) => callback({})) },
}));
jest.mock('../../src/utils/geoScope', () => ({
  isGlobalAdmin: jest.fn(() => true),
  getUserGeoScope: jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn() }));
jest.mock('../../src/services/pilotReadiness.service', () => ({
  loadPilotReadiness: jest.fn(),
}));

const { Country } = require('../../models');
const { loadPilotReadiness } = require('../../src/services/pilotReadiness.service');
const { create, update } = require('../../src/controllers/country.controller');
const { createCountrySchema } = require('../../src/validators/country.schemas');

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

test('a new country requires local settings and starts inactive', async () => {
  expect(createCountrySchema.validate({ name: 'Ghana', isoCode: 'GH' }).error).toBeDefined();
  expect(createCountrySchema.validate({ name: 'Ghana', isoCode: 'GH', currency: 'GHS', defaultLanguage: 'en', timezone: 'Africa/Accra', isActive: true }).error).toBeDefined();

  Country.findOne.mockResolvedValue(null);
  Country.create.mockImplementation(async (values) => ({ id: 2, ...values }));
  const req = {
    user: { role: 'admin' },
    body: { name: 'Ghana', isoCode: 'gh', currency: 'ghs', defaultLanguage: 'en', timezone: 'Africa/Accra' },
  };
  const res = response();
  await create(req, res);

  expect(res.status).toHaveBeenCalledWith(201);
  expect(Country.create).toHaveBeenCalledWith(expect.objectContaining({
    isoCode: 'GH', currency: 'GHS', defaultLanguage: 'en', timezone: 'Africa/Accra', isActive: false,
  }));
});

test('rejects an unknown time zone before writing', async () => {
  Country.findOne.mockResolvedValue(null);
  Country.create.mockClear();
  const res = response();
  await create({ user: { role: 'admin' }, body: { name: 'Ghana', isoCode: 'GH', currency: 'GHS', defaultLanguage: 'en', timezone: 'Nowhere/Unknown' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(Country.create).not.toHaveBeenCalled();
});

test('cannot activate a country with an untranslated default language', async () => {
  const country = {
    id: 2, isoCode: 'AO', defaultLanguage: 'pt', timezone: 'Africa/Luanda', isActive: false,
    save: jest.fn(),
  };
  Country.findByPk.mockResolvedValue(country);
  const res = response();
  await update({ user: { role: 'admin' }, params: { id: '2' }, body: { isActive: true } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(country.save).not.toHaveBeenCalled();
});

test('activation waits for a local operator, services and roles', async () => {
  const country = {
    id: 2, isoCode: 'CI', defaultLanguage: 'fr', timezone: 'Africa/Abidjan', isActive: false,
    save: jest.fn(),
  };
  Country.findByPk.mockResolvedValue(country);
  loadPilotReadiness.mockResolvedValue({
    ready: false,
    issues: [{ code: 'PILOT_CATALOG_NOT_AVAILABLE', severity: 'blocking' }],
  });
  const blocked = response();
  await update({ user: { role: 'admin' }, params: { id: '2' }, body: { isActive: true } }, blocked);
  expect(blocked.status).toHaveBeenCalledWith(409);
  expect(blocked.json).toHaveBeenCalledWith(expect.objectContaining({
    issues: expect.arrayContaining([expect.objectContaining({ code: 'PILOT_CATALOG_NOT_AVAILABLE' })]),
  }));
  expect(country.save).not.toHaveBeenCalled();

  loadPilotReadiness.mockResolvedValue({ ready: true, issues: [] });
  const ready = response();
  await update({ user: { role: 'admin' }, params: { id: '2' }, body: { isActive: true } }, ready);
  expect(loadPilotReadiness).toHaveBeenCalledWith(expect.anything(), 'CI');
  expect(country.save).toHaveBeenCalledTimes(1);
  expect(country.isActive).toBe(true);
});

test('an existing active country can still update its contact before timezone backfill', async () => {
  const country = {
    id: 3, isoCode: 'ML', defaultLanguage: 'fr', timezone: null, isActive: true,
    save: jest.fn(),
  };
  Country.findByPk.mockResolvedValue(country);
  loadPilotReadiness.mockClear();
  const res = response();
  await update({ user: { role: 'admin' }, params: { id: '3' }, body: {
    isActive: true, contactPhone: '+223 20 00 00 00',
  } }, res);
  expect(country.save).toHaveBeenCalledTimes(1);
  expect(loadPilotReadiness).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ country });
});
