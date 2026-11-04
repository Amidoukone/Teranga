'use strict';

jest.mock('../../models', () => ({ Property: { findByPk: jest.fn() }, User: {}, Country: {}, Sequelize: {} }));
jest.mock('../../src/helpers/teranga-imagekit', () => ({}));
jest.mock('../../src/utils/geoScope', () => ({ canAccessGeoResource: jest.fn(() => true), isGlobalAdmin: jest.fn(() => false) }));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn() }));
const { Property } = require('../../models');
const { canAccessGeoResource, isGlobalAdmin } = require('../../src/utils/geoScope');
const { detail } = require('../../src/controllers/property.controller');
const res = () => { const result = { status: jest.fn(), json: jest.fn() }; result.status.mockReturnValue(result); return result; };
beforeEach(() => {
  jest.clearAllMocks(); canAccessGeoResource.mockReturnValue(true); isGlobalAdmin.mockReturnValue(false);
  Property.findByPk.mockResolvedValue({ ownerId: 7, countryId: 1, toJSON: () => ({ id: 3, ownerId: 7, title: 'Maison', photos: [{ url: '/uploads/maison.png' }] }) });
});
test('a detail exposes normalized media only to the owner in the authorized territory', async () => {
  const response = res(); await detail({ params: { id: '3' }, user: { id: 7, role: 'client' } }, response);
  expect(response.json).toHaveBeenCalledWith({ property: expect.objectContaining({ id: 3, photos: ['/uploads/maison.png'] }) });
});
test('a non-owning client is rejected regardless of territory', async () => {
  const response = res(); await detail({ params: { id: '3' }, user: { id: 8, role: 'client' } }, response);
  expect(response.status).toHaveBeenCalledWith(403); expect(response.json).not.toHaveBeenCalledWith(expect.objectContaining({ property: expect.anything() }));
});
test('the owner keeps access to their own property even without a matching territory on their account', async () => {
  // Cas diaspora : le compte client n'a pas de pays/région renseigné, mais reste
  // propriétaire du bien — la propriété prime sur le scope géographique.
  canAccessGeoResource.mockReturnValue(false);
  const response = res(); await detail({ params: { id: '3' }, user: { id: 7, role: 'client' } }, response);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ property: expect.anything() }));
});
test('a scoped administrator outside the territory is still rejected', async () => {
  canAccessGeoResource.mockReturnValue(false);
  const response = res(); await detail({ params: { id: '3' }, user: { id: 9, role: 'admin' } }, response);
  expect(response.status).toHaveBeenCalledWith(403);
});
test('a global administrator may read a property across territories', async () => {
  isGlobalAdmin.mockReturnValue(true); canAccessGeoResource.mockReturnValue(false);
  const response = res(); await detail({ params: { id: '3' }, user: { id: 9, role: 'admin' } }, response);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ property: expect.anything() }));
});
test.each(['0', '3invalid', '-1'])('invalid identifier %s is rejected without a database lookup', async (id) => {
  const response = res(); await detail({ params: { id }, user: { id: 7, role: 'client' } }, response);
  expect(response.status).toHaveBeenCalledWith(400); expect(Property.findByPk).not.toHaveBeenCalled();
});
test('an absent property and a database interruption remain distinguishable', async () => {
  Property.findByPk.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
  let response = res(); await detail({ params: { id: '3' }, user: { id: 7, role: 'client' } }, response); expect(response.status).toHaveBeenCalledWith(404);
  response = res(); await detail({ params: { id: '3' }, user: { id: 7, role: 'client' } }, response); expect(response.status).toHaveBeenCalledWith(500);
});
