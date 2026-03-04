'use strict';

jest.mock('../../models', () => ({
  Order: {
    findOne: jest.fn(),
  },
  OrderItem: {},
  User: {},
  Product: {},
}));

jest.mock('../../src/utils/labels', () => ({
  ORDER_STATUSES: {},
  ORDER_PAYMENT_STATUSES: {},
  PAYMENT_METHODS: {},
  ORDER_CHANNELS: {},
  CURRENCY_LABELS: {},
  getLabel: jest.fn((key) => key),
  formatCurrency: jest.fn((key) => key || 'XOF'),
}));

jest.mock('../../src/utils/pagination', () => ({
  getPagination: jest.fn(() => ({ limit: 25, offset: 0, page: 1 })),
}));

jest.mock('../../src/services/orderLifecycle.service', () => ({
  notifyOrderCreated: jest.fn(async () => {}),
  notifyOrderStatusUpdated: jest.fn(async () => {}),
  syncOrderPaymentTransaction: jest.fn(async () => {}),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScopeForModel: jest.fn((where) => where),
  filterGeoAssignmentsForModel: jest.fn((_model, payload) => payload),
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  getCountryIdByIso: jest.fn(async () => null),
  isGlobalAdmin: jest.fn(() => false),
}));

const { Order } = require('../../models');
const { isGlobalAdmin } = require('../../src/utils/geoScope');
const controller = require('../../src/controllers/order.controller');

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('order.controller remove global admin guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 403 when requester is not global admin', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Order.findOne.mockResolvedValue({
      id: 42,
      status: 'created',
      items: [],
      destroy,
    });
    isGlobalAdmin.mockReturnValue(false);

    const req = {
      user: { id: 7, role: 'admin', countryId: 1, regionId: null },
      params: { id: '42' },
      query: {},
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('administrateur global'),
      })
    );
    expect(destroy).not.toHaveBeenCalled();
  });

  test('deletes order when requester is global admin', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Order.findOne.mockResolvedValue({
      id: 42,
      status: 'created',
      items: [],
      destroy,
    });
    isGlobalAdmin.mockReturnValue(true);

    const req = {
      user: { id: 1, role: 'admin', countryId: null, regionId: null },
      params: { id: '42' },
      query: {},
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Commande supprim'),
      })
    );
  });
});
