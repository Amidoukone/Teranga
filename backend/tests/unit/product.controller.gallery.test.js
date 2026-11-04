'use strict';

jest.mock('../../models', () => ({
  Product: { findOne: jest.fn() },
  Category: {},
}));
jest.mock('../../src/helpers/teranga-imagekit', () => ({ deleteFile: jest.fn() }));
jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScopeForModel: jest.fn((where) => where),
  filterGeoAssignmentsForModel: jest.fn((_model, payload) => payload),
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  isGlobalAdmin: jest.fn(() => true),
}));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));

const { Product } = require('../../models');
const imageKit = require('../../src/helpers/teranga-imagekit');
const logger = require('../../src/utils/logger');
const controller = require('../../src/controllers/product.controller');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('product.controller remove — gallery cleanup', () => {
  beforeEach(() => jest.clearAllMocks());

  test('a failed ImageKit deletion is logged, not silently swallowed, and does not block removal', async () => {
    const prod = {
      id: 5,
      isActive: false,
      gallery: [{ fileId: 'a' }, { fileId: 'b' }],
      destroy: jest.fn(async () => {}),
    };
    Product.findOne.mockResolvedValue(prod);
    imageKit.deleteFile.mockImplementation(async (fileId) => {
      if (fileId === 'a') throw new Error('ImageKit unavailable');
    });

    const req = { user: { role: 'admin' }, params: { id: '5' }, query: {} };
    const res = makeRes();
    await controller.remove(req, res);

    expect(imageKit.deleteFile).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'a', productId: 5 }),
      'product.gallery.imagekit_delete.failed'
    );
    expect(prod.destroy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  test('gallery deletions run in parallel rather than one await per file', async () => {
    const prod = { id: 6, isActive: false, gallery: [{ fileId: 'x' }, { fileId: 'y' }, { fileId: 'z' }], destroy: jest.fn(async () => {}) };
    Product.findOne.mockResolvedValue(prod);
    let concurrentCalls = 0;
    let maxConcurrent = 0;
    imageKit.deleteFile.mockImplementation(async () => {
      concurrentCalls += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
      await Promise.resolve();
      concurrentCalls -= 1;
    });

    await controller.remove({ user: { role: 'admin' }, params: { id: '6' }, query: {} }, makeRes());

    expect(maxConcurrent).toBeGreaterThan(1);
  });
});
