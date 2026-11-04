'use strict';

jest.mock('../../models', () => ({ ProviderLiveLocation: { findOne: jest.fn(), create: jest.fn() } }));

const { ProviderLiveLocation } = require('../../models');
const { upsertProviderLiveLocation } = require('../../src/services/providerPresence.service');

describe('upsertProviderLiveLocation — concurrent first ping', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates a fresh row when none exists and no race occurs', async () => {
    ProviderLiveLocation.findOne.mockResolvedValue(null);
    const created = { id: 1 };
    ProviderLiveLocation.create.mockResolvedValue(created);
    const result = await upsertProviderLiveLocation({ providerId: 7, vehicleId: 3, latitude: 1, longitude: 2 });
    expect(result).toBe(created);
  });

  test('recovers from a concurrent insert instead of surfacing a 500', async () => {
    // Deux pings simultanés : aucun des deux ne trouve de ligne existante...
    ProviderLiveLocation.findOne
      .mockResolvedValueOnce(null)
      // ...le concurrent a déjà inséré la sienne au moment du retry.
      .mockResolvedValueOnce({ id: 1, update: jest.fn(async () => {}) });
    ProviderLiveLocation.create.mockRejectedValue(
      Object.assign(new Error('Duplicate entry'), { name: 'SequelizeUniqueConstraintError' })
    );

    const result = await upsertProviderLiveLocation({ providerId: 7, vehicleId: 3, latitude: 1, longitude: 2 });

    expect(result.id).toBe(1);
    expect(result.update).toHaveBeenCalledTimes(1);
  });

  test('a genuine database error still propagates', async () => {
    ProviderLiveLocation.findOne.mockResolvedValue(null);
    ProviderLiveLocation.create.mockRejectedValue(new Error('connection lost'));
    await expect(upsertProviderLiveLocation({ providerId: 7, latitude: 1, longitude: 2 })).rejects.toThrow('connection lost');
  });
});
