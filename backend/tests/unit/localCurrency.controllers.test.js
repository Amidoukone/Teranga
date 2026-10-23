'use strict';

jest.mock('../../models', () => ({
  Task: { findByPk: jest.fn(), create: jest.fn() },
  Transaction: { findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  Service: { findByPk: jest.fn() },
  Country: { findByPk: jest.fn() },
  Region: { findByPk: jest.fn() },
  Property: { findByPk: jest.fn() },
  Order: { findByPk: jest.fn() },
  Project: { findByPk: jest.fn() },
  User: {},
}));
jest.mock('../../src/utils/geoScope', () => ({
  canAccessGeoResource: jest.fn(() => true),
  getUserGeoScope: jest.fn((user) => ({ countryId: user.countryId, regionId: user.regionId })),
}));
jest.mock('../../src/services/notification.service', () => ({
  getAdminRecipientIds: jest.fn(async () => []),
  computeProgress: jest.fn(() => 0),
}));
jest.mock('../../src/services/activity.service', () => ({ emitEvent: jest.fn() }));
jest.mock('../../src/helpers/teranga-imagekit', () => ({}));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));

const db = require('../../models');
const tasks = require('../../src/controllers/task.controller');
const transactions = require('../../src/controllers/transaction.controller');
const { createTransactionSchema, updateTransactionSchema } = require('../../src/validators/transaction.schemas');

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.resetAllMocks();
  require('../../src/utils/geoScope').canAccessGeoResource.mockReturnValue(true);
  require('../../src/utils/geoScope').getUserGeoScope.mockImplementation((user) => ({ countryId: user.countryId, regionId: user.regionId }));
  require('../../src/services/notification.service').getAdminRecipientIds.mockResolvedValue([]);
  db.Task.create.mockImplementation(async (data) => ({ id: 9, ...data }));
  db.Task.findByPk.mockResolvedValue({ id: 9 });
  db.Transaction.create.mockImplementation(async (data) => ({ id: 10, ...data }));
  db.Transaction.findByPk.mockResolvedValue({ id: 10 });
  db.Country.findByPk.mockResolvedValue({ currency: 'GHS' });
  db.Region.findByPk.mockResolvedValue({ id: 20, countryId: 2 });
});

test('a task loads and inherits its service currency, even after the country changes currency', async () => {
  const service = { id: 8, countryId: 2, regionId: 20, currency: 'GNF' };
  db.Service.findByPk.mockImplementation(async (_id, options) =>
    Object.fromEntries(options.attributes.map((key) => [key, service[key]]))
  );
  const res = response();
  await tasks.create({ user: { id: 1, role: 'admin' }, body: { serviceId: 8, title: 'Suivi', type: 'other' } }, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(db.Task.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'GNF', countryId: 2, regionId: 20 }));
  expect(db.Country.findByPk).not.toHaveBeenCalled();
});

test('a task linked only to a property uses the execution country currency', async () => {
  db.Property.findByPk.mockResolvedValue({ id: 7, countryId: 2, regionId: 20 });
  const res = response();
  await tasks.create({ user: { id: 1, role: 'admin' }, body: { propertyId: 7, title: 'Suivi', type: 'other' } }, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(db.Task.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'GHS' }));
});

test.each(['service', 'task', 'order', 'project'])('a transaction inherits the currency of its linked %s', async (link) => {
  const model = { service: db.Service, task: db.Task, order: db.Order, project: db.Project }[link];
  model.findByPk.mockResolvedValue({ id: 8, countryId: 2, currency: 'GNF' });
  const res = response();
  await transactions.create({ user: { id: 1, role: 'admin' }, body: { [`${link}Id`]: 8, type: 'revenue', amount: 500 } }, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(db.Transaction.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'GNF', countryId: 2 }));
  expect(db.Country.findByPk).not.toHaveBeenCalled();
});

test('an independent transaction uses the country currency while an explicit currency remains authoritative', async () => {
  const req = { user: { id: 1, role: 'admin' }, body: { countryId: 2, type: 'revenue', amount: 500 } };
  const res = response();
  await transactions.create(req, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(db.Transaction.create).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'GHS' }));

  await transactions.create({ ...req, body: { ...req.body, currency: ' gnf ' } }, response());
  expect(db.Transaction.create).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'GNF' }));
});

test.each([createTransactionSchema, updateTransactionSchema])('transaction validation accepts local currencies beyond the historical labels', (schema) => {
  const body = { type: 'revenue', amount: 500, currency: ' gnf ' };
  expect(schema.validate(body).error).toBeUndefined();
  expect(schema.validate(body).value.currency).toBe('GNF');
  expect(schema.validate({ ...body, currency: 'GHS' }).error).toBeUndefined();
  expect(schema.validate({ ...body, currency: 'invalid' }).error).toBeDefined();
});
