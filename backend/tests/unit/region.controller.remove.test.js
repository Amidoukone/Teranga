'use strict';

const { Op } = require('sequelize');

jest.mock('../../models', () => ({
  Region: {
    findByPk: jest.fn(),
  },
  Country: {},
  User: {
    update: jest.fn(),
  },
  Franchise: {
    destroy: jest.fn(),
  },
  Property: {
    destroy: jest.fn(),
  },
  Service: {
    destroy: jest.fn(),
  },
  Transaction: {
    destroy: jest.fn(),
  },
  Product: {
    destroy: jest.fn(),
  },
  Task: {
    destroy: jest.fn(),
  },
  Project: {
    findAll: jest.fn(),
    destroy: jest.fn(),
  },
  Evidence: {
    destroy: jest.fn(),
  },
  Order: {
    findAll: jest.fn(),
    destroy: jest.fn(),
  },
  Activity: {
    destroy: jest.fn(),
  },
  Notification: {
    destroy: jest.fn(),
  },
  OrderItem: {
    destroy: jest.fn(),
  },
  ProjectPhase: {
    destroy: jest.fn(),
  },
  ProjectDocument: {
    destroy: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(),
  },
}));

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
  Activity,
  Notification,
  OrderItem,
  ProjectPhase,
  ProjectDocument,
  sequelize,
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

function setCascadeDefaults() {
  Order.findAll.mockResolvedValue([]);
  Project.findAll.mockResolvedValue([]);
  User.update.mockResolvedValue([0]);

  const destroyModels = [
    Franchise,
    Property,
    Service,
    Transaction,
    Product,
    Task,
    Project,
    Evidence,
    Order,
    Activity,
    Notification,
    OrderItem,
    ProjectPhase,
    ProjectDocument,
  ];

  destroyModels.forEach((model) => {
    model.destroy.mockResolvedValue(0);
  });
}

describe('region.controller remove cascade behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCascadeDefaults();
    sequelize.transaction.mockImplementation(async (callback) =>
      callback('tx-region')
    );
  });

  test('deletes region with all related scoped data in a transaction', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Region.findByPk.mockResolvedValue({ id: 12, countryId: 4, destroy });

    Order.findAll.mockResolvedValue([{ id: 6 }]);
    Project.findAll.mockResolvedValue([{ id: 3 }]);

    const req = {
      user: { role: 'admin' },
      params: { id: '12' },
      query: {},
    };
    const res = makeRes();

    await controller.remove(req, res);

    const expectedWhere = { regionId: 12 };

    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(OrderItem.destroy).toHaveBeenCalledWith({
      where: { orderId: { [Op.in]: [6] } },
      transaction: 'tx-region',
    });
    expect(ProjectDocument.destroy).toHaveBeenCalledWith({
      where: { projectId: { [Op.in]: [3] } },
      transaction: 'tx-region',
    });
    expect(ProjectPhase.destroy).toHaveBeenCalledWith({
      where: { projectId: { [Op.in]: [3] } },
      transaction: 'tx-region',
    });
    expect(Evidence.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Transaction.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Activity.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Notification.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Task.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Service.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Product.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Property.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Project.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Order.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(Franchise.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-region',
    });
    expect(User.update).toHaveBeenNthCalledWith(
      1,
      { countryId: 4 },
      { where: { regionId: 12, countryId: null }, transaction: 'tx-region' }
    );
    expect(User.update).toHaveBeenNthCalledWith(
      2,
      { regionId: null },
      { where: { regionId: 12 }, transaction: 'tx-region' }
    );
    expect(destroy).toHaveBeenCalledWith({ transaction: 'tx-region' });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('returns 404 when region does not exist', async () => {
    Region.findByPk.mockResolvedValue(null);

    const req = {
      user: { role: 'admin' },
      params: { id: '404' },
      query: {},
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('introuvable'),
      })
    );
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });
});
