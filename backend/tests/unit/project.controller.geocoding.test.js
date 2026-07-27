'use strict';

jest.mock('../../models', () => ({
  Project: {
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  ProjectPhase: {},
  Region: { findOne: jest.fn() },
  User: { findByPk: jest.fn() },
}));

jest.mock('../../src/utils/geoScope', () => ({
  canAccessGeoResource: jest.fn(() => true),
  getCountryIdByIso: jest.fn(async () => null),
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  isGlobalAdmin: jest.fn(() => true),
  applyGeoScopeForModel: jest.fn((where) => where),
}));

jest.mock('../../src/services/notification.service', () => ({
  getAdminRecipientIds: jest.fn(async () => []),
  computeProgress: jest.fn(() => 0),
}));

jest.mock('../../src/services/activity.service', () => ({
  emitEvent: jest.fn(async () => {}),
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

const { Project, User } = require('../../models');
const { geocodeAddress } = require('../../src/services/geocoding.service');
const controller = require('../../src/controllers/project.controller');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('project.controller geocoding (non bloquant)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findByPk.mockResolvedValue({
      id: 10,
      role: 'client',
      countryId: null,
      regionId: null,
      country: null,
    });
    Project.create.mockResolvedValue({ id: 99, agentId: null });
    Project.findByPk.mockResolvedValue({
      toJSON: () => ({ id: 99, title: 'Projet test' }),
      agent: null,
    });
  });

  test('create geocodes address+city when no lat/lng are provided', async () => {
    geocodeAddress.mockResolvedValue({ latitude: 12.6392, longitude: -8.0029 });

    const req = {
      user: { id: 10, role: 'client' },
      body: { title: 'Projet test', type: 'immobilier', address: 'Rue 1', city: 'Bamako' },
    };
    const res = makeRes();

    await controller.create(req, res);

    expect(geocodeAddress).toHaveBeenCalledWith('Rue 1, Bamako');
    expect(Project.create).toHaveBeenCalledTimes(1);
    expect(Project.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ latitude: 12.6392, longitude: -8.0029 })
    );
  });

  test('create succeeds with null coordinates when geocoding fails (never blocking)', async () => {
    geocodeAddress.mockResolvedValue(null);

    const req = {
      user: { id: 10, role: 'client' },
      body: { title: 'Projet test', type: 'immobilier', address: 'Adresse floue', city: 'Bamako' },
    };
    const res = makeRes();

    await controller.create(req, res);

    expect(Project.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ latitude: null, longitude: null })
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('create succeeds without any address at all (localisation optionnelle)', async () => {
    const req = {
      user: { id: 10, role: 'client' },
      body: { title: 'Projet test', type: 'immobilier' },
    };
    const res = makeRes();

    await controller.create(req, res);

    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(Project.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ address: null, city: null, latitude: null, longitude: null })
    );
  });
});
