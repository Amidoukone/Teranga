'use strict';

jest.mock('../../models', () => Object.fromEntries(['Service', 'Task', 'Order', 'Project', 'Country', 'Region'].map((name) => [name, { findByPk: jest.fn() }])));
jest.mock('../../src/utils/geoScope', () => ({
  canAccessGeoResource: jest.fn(() => true),
  getUserGeoScope: jest.fn((user) => ({ countryId: user.countryId, regionId: user.regionId })),
  getCountryIdByIso: jest.fn(),
}));
const db = require('../../models');
const { resolveTransactionContext } = require('../../src/services/transactionContext.service');
const actor = { id: 1, role: 'admin', countryId: null, regionId: null };
beforeEach(() => {
  jest.clearAllMocks();
  for (const model of Object.values(db)) model.findByPk.mockResolvedValue(null);
  db.Country.findByPk.mockResolvedValue({ currency: 'GHS' });
});

test('a missing target cannot silently erase an existing link', async () => {
  await expect(resolveTransactionContext({ user: actor, body: { serviceId: 999 } }, { previous: { serviceId: 1, countryId: 2 } })).rejects.toMatchObject({ status: 400 });
});

test.each([
  [{ id: 1, countryId: 2 }, { id: 2, countryId: 3 }],
  [{ id: 1, countryId: 2, regionId: 20 }, { id: 2, countryId: 2, regionId: 21 }],
])('links from different execution territories are rejected', async (service, project) => {
  db.Service.findByPk.mockResolvedValue(service);
  db.Project.findByPk.mockResolvedValue(project);
  await expect(resolveTransactionContext({ user: actor, body: { serviceId: 1, projectId: 2 } })).rejects.toMatchObject({ status: 400 });
});

test('a task must belong to the supplied service', async () => {
  db.Service.findByPk.mockResolvedValue({ id: 1, countryId: 2 });
  db.Task.findByPk.mockResolvedValue({ id: 2, countryId: 2, serviceId: 3 });
  await expect(resolveTransactionContext({ user: actor, body: { serviceId: 1, taskId: 2 } })).rejects.toMatchObject({ status: 400 });
});

test('changing a link derives the new geography without carrying the old region', async () => {
  db.Service.findByPk.mockResolvedValue({ id: 2, countryId: 3, currency: 'USD' });
  const result = await resolveTransactionContext({ user: actor, body: { serviceId: 2 } }, { previous: { serviceId: 1, countryId: 2, regionId: 20, currency: 'GHS' } });
  expect(result).toMatchObject({ countryId: 3, regionId: null, currency: 'USD' });
});

test('a region override must belong to the linked country', async () => {
  db.Service.findByPk.mockResolvedValue({ id: 1, countryId: 2, currency: 'GHS' });
  db.Region.findByPk.mockResolvedValue({ id: 30, countryId: 3 });
  await expect(resolveTransactionContext({ user: actor, body: { serviceId: 1, regionId: 30 } })).rejects.toMatchObject({ status: 400 });
});

test('a foreign client can use owned links and cannot use another client links', async () => {
  const user = { id: 4, role: 'client', countryId: 2, regionId: 20 };
  db.Service.findByPk.mockResolvedValue({ id: 1, clientId: 4, countryId: 3, currency: 'USD' });
  await expect(resolveTransactionContext({ user, body: { serviceId: 1 } })).resolves.toMatchObject({ countryId: 3, regionId: null });
  db.Service.findByPk.mockResolvedValue({ id: 1, clientId: 5, countryId: 3, currency: 'USD' });
  await expect(resolveTransactionContext({ user, body: { serviceId: 1 } })).rejects.toMatchObject({ status: 403 });
});

test('a legacy order retains its customer region when its execution country is not yet populated', async () => {
  db.Order.findByPk.mockResolvedValue({ id: 1, currency: 'GHS', user: { countryId: 2, regionId: 20 } });
  db.Region.findByPk.mockResolvedValue({ id: 20, countryId: 2 });
  await expect(resolveTransactionContext({ user: actor, body: { orderId: 1 } })).resolves.toMatchObject({ countryId: 2, regionId: 20 });
});
