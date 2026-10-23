'use strict';

const { Op } = require('sequelize');
const { ServiceAvailability } = require('../../models');
const { isServiceAvailable } = require('../../src/services/localCatalog.service');

afterEach(() => jest.restoreAllMocks());

test('legacy country without projected offerings keeps its existing service flow', async () => {
  jest.spyOn(ServiceAvailability, 'count').mockResolvedValue(0);
  const findOne = jest.spyOn(ServiceAvailability, 'findOne');
  expect(await isServiceAvailable({ countryId: 1, serviceType: 'errand' })).toBe(true);
  expect(findOne).not.toHaveBeenCalled();
});

test('legacy database without the catalog table keeps existing services available', async () => {
  jest.spyOn(ServiceAvailability, 'count').mockRejectedValue({
    original: { code: 'ER_NO_SUCH_TABLE' },
  });
  const findOne = jest.spyOn(ServiceAvailability, 'findOne');
  expect(await isServiceAvailable({ countryId: 1, serviceType: 'errand' })).toBe(true);
  expect(findOne).not.toHaveBeenCalled();
});

test('configured country only accepts an active local offering for the selected service', async () => {
  jest.spyOn(ServiceAvailability, 'count').mockResolvedValue(2);
  const findOne = jest.spyOn(ServiceAvailability, 'findOne')
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ id: 9 });

  expect(await isServiceAvailable({ countryId: 2, regionId: 20, tradeCategoryId: 8 })).toBe(false);
  expect(await isServiceAvailable({ countryId: 2, regionId: 20, serviceType: 'errand' })).toBe(true);

  const query = findOne.mock.calls[0][0];
  expect(query.where.isActive).toBe(true);
  expect(query.where[Op.and]).toHaveLength(2);
  expect(query.include).toEqual(expect.arrayContaining([
    expect.objectContaining({ as: 'definition', where: { isActive: true, legacyTradeCategoryId: 8 } }),
    expect.objectContaining({ as: 'territory', where: {
      isActive: true,
      [Op.or]: [{ regionId: 20, countryId: 2 }, { type: 'COUNTRY', countryId: 2 }],
    } }),
    expect.objectContaining({ as: 'operatingOrganization', where: { status: 'active' } }),
  ]));
});
