'use strict';
jest.mock('../../models', () => ({ Provider: { findOne: jest.fn(), update: jest.fn() }, Service: { count: jest.fn() } }));
jest.mock('../../src/services/mobilityCompliance.service', () => ({ findEligibleVehicleForProvider: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn() }));
const { Provider, Service } = require('../../models');
const { findEligibleVehicleForProvider } = require('../../src/services/mobilityCompliance.service');
const { updateMyAvailability } = require('../../src/controllers/provider.controller');
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
let provider;
beforeEach(() => {
  jest.clearAllMocks();
  provider = { id: 4, status: 'active', availabilityStatus: 'offline', tradeCategories: [{ slug: 'mobilite' }], reload: jest.fn() };
  Provider.findOne.mockResolvedValue(provider); Provider.update.mockResolvedValue([1]); Service.count.mockResolvedValue(0);
  findEligibleVehicleForProvider.mockResolvedValue({ vehicle: { id: 12 } });
});
test('a reservation made during the availability check cannot be overwritten', async () => {
  Provider.update.mockResolvedValue([0]);
  provider.reload.mockImplementationOnce(async () => { provider.availabilityStatus = 'busy'; });
  const res = response();
  await updateMyAvailability({ user: { id: 7 }, body: { availabilityStatus: 'available', vehicleId: 12 } }, res);
  expect(Provider.update).toHaveBeenCalledWith({ availabilityStatus: 'available' }, { where: { id: 4, status: 'active', availabilityStatus: 'offline' } });
  expect(res.status).toHaveBeenCalledWith(409);
  expect(provider.reload).toHaveBeenCalled();
});

test('a repeated declaration is successful when MySQL reports zero changed rows', async () => {
  Provider.update.mockResolvedValue([0]);
  const res = response();
  await updateMyAvailability({ user: { id: 7 }, body: { availabilityStatus: 'offline' } }, res);
  expect(res.json).toHaveBeenCalledWith({ provider });
  expect(res.status).not.toHaveBeenCalledWith(409);
});
test('an assigned ride blocks a self-service availability change before writing', async () => {
  Service.count.mockResolvedValue(1);
  const res = response();
  await updateMyAvailability({ user: { id: 7 }, body: { availabilityStatus: 'offline' } }, res);
  expect(res.status).toHaveBeenCalledWith(409); expect(Provider.update).not.toHaveBeenCalled();
});
