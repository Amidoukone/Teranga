'use strict';

jest.mock('../../models', () => ({
  Product: {
    findAndCountAll: jest.fn(),
  },
  Category: {},
}));

jest.mock('../../src/helpers/teranga-imagekit', () => ({
  upload: jest.fn(),
  deleteFile: jest.fn(),
}));

jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScopeForModel: jest.fn((where) => where),
  filterGeoAssignmentsForModel: jest.fn((_model, assignments) => assignments),
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  isGlobalAdmin: jest.fn(() => true),
}));

jest.mock('../../src/utils/pagination', () => ({
  getPagination: jest.fn(() => ({ limit: 50, offset: 0, page: 1 })),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Product } = require('../../models');
const ctrl = require('../../src/controllers/product.controller');

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('product.controller list geo filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('applies countryId and regionId query filters when provided', async () => {
    Product.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const req = {
      user: { role: 'admin' },
      query: {
        countryId: '12',
        regionId: '45',
      },
    };
    const res = makeRes();

    await ctrl.list(req, res);

    expect(Product.findAndCountAll).toHaveBeenCalledTimes(1);
    const args = Product.findAndCountAll.mock.calls[0][0];
    expect(args.where.countryId).toBe(12);
    expect(args.where.regionId).toBe(45);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        products: expect.any(Array),
        pagination: expect.any(Object),
      })
    );
  });

  test('ignores invalid countryId/regionId query values', async () => {
    Product.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const req = {
      user: { role: 'admin' },
      query: {
        countryId: 'abc',
        regionId: '',
      },
    };
    const res = makeRes();

    await ctrl.list(req, res);

    const args = Product.findAndCountAll.mock.calls[0][0];
    expect(args.where.countryId).toBeUndefined();
    expect(args.where.regionId).toBeUndefined();
    expect(res.json).toHaveBeenCalled();
  });
});
