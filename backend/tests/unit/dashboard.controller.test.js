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
      { currency: 'XOF', type: 'revenue', amount: '100', count: '1' },
      { currency: 'XOF', type: 'expense', amount: '40', count: '1' },
      { currency: 'XOF', type: 'commission', amount: '10', count: '1' },
      { currency: 'XOF', type: 'adjustment', amount: '5', count: '1' },
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
        multiCurrency: false,
        byCurrency: [
          {
            currency: 'XOF',
            revenues: 100,
            expenses: 40,
            commissions: 10,
            adjustments: 5,
            balance: 55,
          },
        ],
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

  test('never sums amounts across different currencies into a single total', async () => {
    Service.findAll.mockResolvedValue([{ total: '0', active: '0' }]);
    Transaction.findAll.mockResolvedValue([
      { currency: 'XOF', type: 'revenue', amount: '100', count: '1' },
      { currency: 'GHS', type: 'revenue', amount: '50', count: '1' },
    ]);
    Property.findAll.mockResolvedValue([{ total: '0', active: '0' }]);
    Task.findAll.mockResolvedValue([{ total: '0', created: '0', inProgress: '0', completed: '0', validated: '0' }]);
    Project.findAll.mockResolvedValue([{ total: '0', created: '0', inProgress: '0', completed: '0', validated: '0' }]);
    Order.findAll.mockResolvedValue([{ total: '0', paid: '0', open: '0' }]);

    const req = { user: { id: 7, role: 'admin' }, query: {} };
    const res = { set: jest.fn(), json: jest.fn(), status: jest.fn().mockReturnThis() };

    await summary(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.financeSummary.multiCurrency).toBe(true);
    expect(payload.financeSummary.revenues).toBeNull();
    expect(payload.financeSummary.balance).toBeNull();
    expect(payload.stats.totalRevenue).toBeNull();
    expect(payload.stats.totalExpense).toBeNull();
    expect(payload.stats.balance).toBeNull();
    expect(payload.financeSummary.byCurrency).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'XOF', revenues: 100 }),
        expect.objectContaining({ currency: 'GHS', revenues: 50 }),
      ])
    );
  });
});
