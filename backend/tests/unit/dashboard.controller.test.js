'use strict';

describe('dashboard controller summary aggregation', () => {
  let summary;
  let Service;
  let Task;
  let Project;
  let Order;
  let Property;
  let Transaction;

  beforeEach(() => {
    jest.resetModules();

    Service = { findAll: jest.fn() };
    Task = { findAll: jest.fn() };
    Project = { findAll: jest.fn() };
    Order = { findAll: jest.fn() };
    Property = { findAll: jest.fn() };
    Transaction = { findAll: jest.fn() };

    jest.doMock('../../models', () => ({
      Service,
      Task,
      Project,
      Order,
      Property,
      Transaction,
      User: {},
    }));

    jest.doMock('../../src/utils/geoScope', () => ({
      applyGeoScopeForModel: jest.fn((where) => where),
      getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
      isGlobalAdmin: jest.fn(() => false),
      toSafeInt: jest.fn((value) => {
        const parsed = Number.parseInt(String(value), 10);
        return Number.isFinite(parsed) ? parsed : null;
      }),
    }));

    jest.doMock('../../src/services/transaction.service', () => ({
      buildWhereWithACL: jest.fn(() => ({})),
      COMMON_INCLUDE: [],
    }));

    jest.doMock('../../src/utils/logger', () => ({
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    }));

    ({ summary } = require('../../src/controllers/dashboard.controller'));
  });

  test('returns the same dashboard shape while querying each section once', async () => {
    Service.findAll.mockResolvedValue([{ total: '10', active: '6' }]);
    Transaction.findAll.mockResolvedValue([
      {
        count: '4',
        revenues: '100',
        expenses: '40',
        commissions: '10',
        adjustments: '5',
      },
    ]);
    Property.findAll.mockResolvedValue([{ total: '3', active: '2' }]);
    Task.findAll.mockResolvedValue([
      {
        total: '5',
        created: '1',
        inProgress: '2',
        completed: '1',
        validated: '1',
      },
    ]);
    Project.findAll.mockResolvedValue([
      {
        total: '2',
        created: '1',
        inProgress: '0',
        completed: '1',
        validated: '0',
      },
    ]);
    Order.findAll.mockResolvedValue([{ total: '4', paid: '1', open: '3' }]);

    const req = {
      user: { id: 7, role: 'client' },
      query: {},
    };
    const res = {
      set: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await summary(req, res);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(Service.findAll).toHaveBeenCalledTimes(1);
    expect(Transaction.findAll).toHaveBeenCalledTimes(1);
    expect(Property.findAll).toHaveBeenCalledTimes(1);
    expect(Task.findAll).toHaveBeenCalledTimes(1);
    expect(Project.findAll).toHaveBeenCalledTimes(1);
    expect(Order.findAll).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      stats: {
        servicesCount: 10,
        activeServices: 6,
        transactionsCount: 4,
        totalRevenue: 100,
        totalExpense: 55,
        balance: 45,
      },
      detailStats: {
        properties: { total: 3, active: 2 },
        tasks: {
          total: 5,
          created: 1,
          inProgress: 2,
          completed: 1,
          validated: 1,
        },
        projects: {
          total: 2,
          created: 1,
          inProgress: 0,
          completed: 1,
          validated: 0,
        },
        orders: { total: 4, paid: 1, open: 3 },
      },
      financeSummary: {
        revenues: 100,
        expenses: 40,
        commissions: 10,
        adjustments: 5,
        balance: 55,
      },
      financeWidgetSummary: {
        revenue: 100,
        expense: 40,
        commission: 10,
        adjustment: 5,
      },
      meta: expect.objectContaining({
        role: 'client',
        partial: false,
        failedSections: [],
      }),
    });
  });
});
