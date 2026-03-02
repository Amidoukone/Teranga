'use strict';

jest.mock('../../models', () => {
  const makeCountModel = () => ({ count: jest.fn() });

  return {
    Region: {
      findByPk: jest.fn(),
    },
    Country: {},
    User: {
      count: jest.fn(),
      update: jest.fn(),
    },
    Franchise: makeCountModel(),
    Property: makeCountModel(),
    Service: makeCountModel(),
    Transaction: makeCountModel(),
    Product: makeCountModel(),
    Task: makeCountModel(),
    Project: makeCountModel(),
    Evidence: makeCountModel(),
    Order: makeCountModel(),
  };
});

jest.mock('../../src/utils/geoScope', () => ({
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  isGlobalAdmin: jest.fn(() => true),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  Region,
  User,
  Franchise,
  Property,
  Service,
  Transaction,
  Product,
  Task,
  Project,
  Evidence,
  Order,
} = require('../../models');
const controller = require('../../src/controllers/region.controller');

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function setNoRegionUsageDefaults() {
  Franchise.count.mockResolvedValue(0);
  Property.count.mockResolvedValue(0);
  Service.count.mockResolvedValue(0);
  Transaction.count.mockResolvedValue(0);
  Product.count.mockResolvedValue(0);
  Task.count.mockResolvedValue(0);
  Project.count.mockResolvedValue(0);
  Evidence.count.mockResolvedValue(0);
  Order.count.mockResolvedValue(0);
}

describe('region.controller remove force behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNoRegionUsageDefaults();
  });

  test('returns 409 when users are still linked and force is not provided', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Region.findByPk.mockResolvedValue({ id: 12, countryId: 4, destroy });
    User.count.mockResolvedValue(1);

    const req = {
      user: { role: 'admin' },
      params: { id: '12' },
      query: {},
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('utilisateurs'),
      })
    );
    expect(User.update).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  test('force delete detaches users from region and keeps country scope', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Region.findByPk.mockResolvedValue({ id: 12, countryId: 4, destroy });

    let regionUsageChecks = 0;
    User.count.mockImplementation(({ where }) => {
      if (where?.regionId === 12) {
        regionUsageChecks += 1;
        return Promise.resolve(regionUsageChecks === 1 ? 2 : 0);
      }
      return Promise.resolve(0);
    });

    const req = {
      user: { role: 'admin' },
      params: { id: '12' },
      query: { force: 'true' },
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(User.update).toHaveBeenNthCalledWith(
      1,
      { countryId: 4 },
      { where: { regionId: 12, countryId: null } }
    );
    expect(User.update).toHaveBeenNthCalledWith(
      2,
      { regionId: null },
      { where: { regionId: 12 } }
    );
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
