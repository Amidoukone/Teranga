'use strict';

jest.mock('../../models', () => ({
  Property: {
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
  },
  Country: {
    findOne: jest.fn(),
  },
  Sequelize: {
    fn: jest.fn(),
    col: jest.fn(),
    where: jest.fn(),
  },
}));

jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScopeForModel: jest.fn((where) => where),
  canAccessGeoResource: jest.fn(() => true),
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  isGlobalAdmin: jest.fn(() => true),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/services/geocoding.service', () => ({
  geocodeAddress: jest.fn(),
}));

const { Property } = require('../../models');
const { geocodeAddress } = require('../../src/services/geocoding.service');
const controller = require('../../src/controllers/property.controller');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('property.controller geocoding (non bloquant)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Property.create.mockResolvedValue({ id: 77 });
    Property.findByPk.mockResolvedValue({
      toJSON: () => ({ id: 77, title: 'Villa test', address: 'Rue 1', city: 'Bamako' }),
    });
  });

  test('create geocodes the address when no lat/lng are provided', async () => {
    geocodeAddress.mockResolvedValue({
      latitude: 12.6392,
      longitude: -8.0029,
      formattedAddress: 'Rue 1, Bamako, Mali',
    });

    const req = {
      user: { id: 10, role: 'client', country: null, countryId: null, regionId: null },
      body: { title: 'Villa test', type: 'house', address: 'Rue 1', city: 'Bamako' },
      files: [],
    };
    const res = makeRes();

    await controller.create(req, res);

    expect(geocodeAddress).toHaveBeenCalledWith('Rue 1, Bamako');
    expect(Property.create).toHaveBeenCalledTimes(1);
    expect(Property.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ latitude: 12.6392, longitude: -8.0029 })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('create succeeds with null coordinates when geocoding fails (never blocking)', async () => {
    geocodeAddress.mockResolvedValue(null);

    const req = {
      user: { id: 10, role: 'client', country: null, countryId: null, regionId: null },
      body: { title: 'Villa test', type: 'house', address: 'Adresse introuvable', city: 'Bamako' },
      files: [],
    };
    const res = makeRes();

    await controller.create(req, res);

    expect(Property.create).toHaveBeenCalledTimes(1);
    expect(Property.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ latitude: null, longitude: null })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('create skips geocoding when lat/lng are already provided', async () => {
    const req = {
      user: { id: 10, role: 'client', country: null, countryId: null, regionId: null },
      body: {
        title: 'Villa test',
        type: 'house',
        address: 'Rue 1',
        city: 'Bamako',
        latitude: 12.6,
        longitude: -8.0,
      },
      files: [],
    };
    const res = makeRes();

    await controller.create(req, res);

    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(Property.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ latitude: 12.6, longitude: -8.0 })
    );
  });

  test('update re-geocodes when address changes without explicit coordinates', async () => {
    const updateMock = jest.fn().mockResolvedValue(undefined);
    const existingProperty = {
      id: 77,
      ownerId: 10,
      address: 'Ancienne rue',
      city: 'Bamako',
      latitude: 12.6,
      longitude: -8.0,
      photos: [],
      update: updateMock,
    };
    Property.findByPk
      .mockResolvedValueOnce(existingProperty)
      .mockResolvedValueOnce({
        toJSON: () => ({ id: 77, title: 'Villa test', address: 'Nouvelle rue', city: 'Bamako' }),
      });
    geocodeAddress.mockResolvedValue({
      latitude: 12.7,
      longitude: -8.1,
      formattedAddress: 'Nouvelle rue, Bamako',
    });

    const req = {
      params: { id: '77' },
      user: { id: 10, role: 'client', country: null, countryId: null, regionId: null },
      body: { address: 'Nouvelle rue' },
      files: [],
    };
    const res = makeRes();

    await controller.update(req, res);

    expect(geocodeAddress).toHaveBeenCalledWith('Nouvelle rue, Bamako');
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 12.7, longitude: -8.1 })
    );
  });
});
