'use strict';

jest.mock('../../models', () => ({
  OrderItem: { create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(), findAndCountAll: jest.fn() },
  Order: { findOne: jest.fn(), findByPk: jest.fn() },
  Product: { findByPk: jest.fn() },
  User: {},
  sequelize: { transaction: jest.fn() },
}));
jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScope: jest.fn((where) => where),
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  isGlobalAdmin: jest.fn(() => true),
}));
jest.mock('../../src/utils/labels', () => ({
  ORDER_ITEM_STATUSES: {}, ORDER_STATUSES: {}, ORDER_PAYMENT_STATUSES: {}, PAYMENT_METHODS: {}, ORDER_CHANNELS: {},
  getLabel: jest.fn((key) => key), formatCurrency: jest.fn((key) => key || 'XOF'),
}));
jest.mock('../../src/utils/pagination', () => ({ getPagination: jest.fn(() => ({ limit: 25, offset: 0, page: 1 })) }));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn() }));

const { OrderItem, Order, Product, sequelize } = require('../../models');
const controller = require('../../src/controllers/orderItem.controller');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('orderItem.controller create — stock concurrency', () => {
  const order = { id: 5, userId: 1, status: 'created', countryId: null, regionId: null, tax: 0, shipping: 0, save: jest.fn(async () => {}) };

  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (callback) => callback('tx'));
    Order.findOne.mockResolvedValue(order);
    Order.findByPk.mockResolvedValue(order);
    OrderItem.findByPk.mockResolvedValue({ id: 99, product: null });
  });

  test('locks the product row inside the transaction before checking stock', async () => {
    const product = { id: 7, name: 'Casque', stock: 2, price: 10, update: jest.fn(async (fields) => Object.assign(product, fields)) };
    Product.findByPk.mockResolvedValue(product);
    OrderItem.create.mockResolvedValue({ id: 99 });
    OrderItem.findAll.mockResolvedValue([]);

    const req = { params: { orderId: '5' }, user: { id: 1, role: 'admin' }, body: { productId: 7, quantity: 1 } };
    const res = makeRes();
    await controller.create(req, res);

    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    // Le verrou doit être posé sur la lecture DANS la transaction, pas sur la lecture de scope précédente.
    const lockedCall = Product.findByPk.mock.calls.find(([, opts]) => opts?.lock === true);
    expect(lockedCall).toBeDefined();
    expect(lockedCall[1].transaction).toBe('tx');
    expect(product.update).toHaveBeenCalledWith({ stock: 1 }, { transaction: 'tx' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rejects when the locked stock is insufficient, without creating the item', async () => {
    const product = { id: 7, name: 'Casque', stock: 0, price: 10, update: jest.fn() };
    Product.findByPk.mockResolvedValue(product);

    const req = { params: { orderId: '5' }, user: { id: 1, role: 'admin' }, body: { productId: 7, quantity: 1 } };
    const res = makeRes();
    await controller.create(req, res);

    expect(OrderItem.create).not.toHaveBeenCalled();
    expect(product.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
