'use strict';

jest.mock('../../models', () => {
  const makeCountModel = () => ({ count: jest.fn() });

  return {
    Country: {
      findByPk: jest.fn(),
    },
    Region: makeCountModel(),
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
  Country,
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
const controller = require('../../src/controllers/country.controller');

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function setNoCountryUsageDefaults() {
  Region.count.mockResolvedValue(0);
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

describe('country.controller remove force behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNoCountryUsageDefaults();
  });

  test('returns 409 when users are still linked and force is not provided', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Country.findByPk.mockResolvedValue({ id: 7, destroy });

    User.count.mockImplementation(({ where }) => {
      if (where?.role === 'admin') return Promise.resolve(0);
      if (where?.countryId === 7) return Promise.resolve(2);
      return Promise.resolve(0);
    });

    const req = {
      user: { role: 'admin' },
      params: { id: '7' },
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

  test('force delete detaches non-admin users and deletes the country', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Country.findByPk.mockResolvedValue({ id: 7, destroy });

    let countryUsageChecks = 0;
    User.count.mockImplementation(({ where }) => {
      if (where?.role === 'admin') return Promise.resolve(0);
      if (where?.countryId === 7) {
        countryUsageChecks += 1;
        return Promise.resolve(countryUsageChecks === 1 ? 3 : 0);
      }
      return Promise.resolve(0);
    });

    const req = {
      user: { role: 'admin' },
      params: { id: '7' },
      query: { force: 'true' },
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(User.update).toHaveBeenCalledWith(
      { countryId: null, regionId: null },
      { where: { countryId: 7 } }
    );
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('force delete is rejected when admin/master users are still linked', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Country.findByPk.mockResolvedValue({ id: 7, destroy });

    User.count.mockImplementation(({ where }) => {
      if (where?.role === 'admin') return Promise.resolve(1);
      if (where?.countryId === 7) return Promise.resolve(2);
      return Promise.resolve(0);
    });

    const req = {
      user: { role: 'admin' },
      params: { id: '7' },
      query: { force: 'true' },
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('admin/master'),
      })
    );
    expect(User.update).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });
});
