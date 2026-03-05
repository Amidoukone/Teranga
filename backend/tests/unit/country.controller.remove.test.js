'use strict';

const { Op } = require('sequelize');

jest.mock('../../models', () => ({
  Country: {
    findByPk: jest.fn(),
  },
  Region: {
    findAll: jest.fn(),
    destroy: jest.fn(),
  },
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
  Activity,
  Notification,
  OrderItem,
  ProjectPhase,
  ProjectDocument,
  sequelize,
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

function setCascadeDefaults() {
  Region.findAll.mockResolvedValue([]);
  Order.findAll.mockResolvedValue([]);
  Project.findAll.mockResolvedValue([]);
  User.update.mockResolvedValue([0]);

  const destroyModels = [
    Region,
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

describe('country.controller remove cascade behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setCascadeDefaults();
    sequelize.transaction.mockImplementation(async (callback) =>
      callback('tx-country')
    );
  });

  test('deletes country with all related scoped data in a transaction', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Country.findByPk.mockResolvedValue({ id: 7, destroy });

    Region.findAll.mockResolvedValue([{ id: 12 }, { id: '13' }]);
    Order.findAll.mockResolvedValue([{ id: 100 }, { id: '101' }]);
    Project.findAll.mockResolvedValue([{ id: 9 }]);

    const req = {
      user: { role: 'admin' },
      params: { id: '7' },
      query: {},
    };
    const res = makeRes();

    await controller.remove(req, res);

    const expectedWhere = {
      [Op.or]: [{ countryId: 7 }, { regionId: { [Op.in]: [12, 13] } }],
    };

    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(OrderItem.destroy).toHaveBeenCalledWith({
      where: { orderId: { [Op.in]: [100, 101] } },
      transaction: 'tx-country',
    });
    expect(ProjectDocument.destroy).toHaveBeenCalledWith({
      where: { projectId: { [Op.in]: [9] } },
      transaction: 'tx-country',
    });
    expect(ProjectPhase.destroy).toHaveBeenCalledWith({
      where: { projectId: { [Op.in]: [9] } },
      transaction: 'tx-country',
    });
    expect(Evidence.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Transaction.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Activity.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Notification.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Task.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Service.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Product.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Property.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Project.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Order.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(Franchise.destroy).toHaveBeenCalledWith({
      where: expectedWhere,
      transaction: 'tx-country',
    });
    expect(User.update).toHaveBeenCalledWith(
      { countryId: null, regionId: null, country: null },
      { where: expectedWhere, transaction: 'tx-country' }
    );
    expect(Region.destroy).toHaveBeenCalledWith({
      where: { countryId: 7 },
      transaction: 'tx-country',
    });
    expect(destroy).toHaveBeenCalledWith({ transaction: 'tx-country' });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  test('returns 404 when country does not exist', async () => {
    Country.findByPk.mockResolvedValue(null);

    const req = {
      user: { role: 'admin' },
      params: { id: '999' },
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
