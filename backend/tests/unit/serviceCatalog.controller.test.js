'use strict';

const { Op } = require('sequelize');
const { Country, Region, ServiceAvailability } = require('../../models');
const controller = require('../../src/controllers/serviceCatalog.controller');
const {
  buildTerritoryWhere,
  preferMostSpecificAvailability,
} = require('../../src/controllers/serviceCatalog.controller');

describe('service catalog controller selection', () => {
  afterEach(() => jest.restoreAllMocks());

  test('requires a country and rejects a region from another country', async () => {
    const response = () => {
      const res = { status: jest.fn(), json: jest.fn() };
      res.status.mockReturnValue(res);
      return res;
    };
    const missingCountry = response();
    await controller.list({ query: {} }, missingCountry);
    expect(missingCountry.status).toHaveBeenCalledWith(400);

    jest.spyOn(Country, 'findByPk').mockResolvedValue({ id: 2, isActive: true });
    jest.spyOn(Region, 'findByPk').mockResolvedValue({ id: 20, countryId: 3, isActive: true });
    const findAll = jest.spyOn(ServiceAvailability, 'findAll');
    const wrongRegion = response();
    await controller.list({ query: { countryId: '2', regionId: '20' } }, wrongRegion);
    expect(wrongRegion.status).toHaveBeenCalledWith(400);
    expect(findAll).not.toHaveBeenCalled();
  });

  test('public catalog only queries active offerings in the selected country', async () => {
    jest.spyOn(Country, 'findByPk').mockResolvedValue({ id: 2, isActive: true });
    const findAll = jest.spyOn(ServiceAvailability, 'findAll').mockResolvedValue([]);
    jest.spyOn(ServiceAvailability, 'count').mockResolvedValue(1);
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);
    await controller.list({ query: { countryId: '2' } }, res);
    expect(res.json).toHaveBeenCalledWith({ catalog: [], configured: true });
    const query = findAll.mock.calls[0][0];
    expect(query.where.isActive).toBe(true);
    expect(query.include).toEqual(expect.arrayContaining([
      expect.objectContaining({ as: 'territory', where: { isActive: true, type: 'COUNTRY', countryId: 2 } }),
      expect.objectContaining({ as: 'operatingOrganization', where: { status: 'active' } }),
    ]));
  });

  test('uses a regional offering with a country fallback', () => {
    const where = buildTerritoryWhere({ countryId: '2', regionId: '20' });
    expect(where[Op.or]).toEqual([
      { regionId: 20, countryId: 2 },
      { type: 'COUNTRY', countryId: 2 },
    ]);
  });

  test('prefers the most specific offering for each definition', () => {
    const records = [
      { id: 1, serviceDefinitionId: 9, territory: { type: 'COUNTRY' } },
      { id: 2, serviceDefinitionId: 9, territory: { type: 'REGION' } },
      { id: 3, serviceDefinitionId: 10, territory: { type: 'COUNTRY' } },
    ];
    expect(preferMostSpecificAvailability(records).map(({ id }) => id)).toEqual([2, 3]);
  });

  test('country administrators can manage regional offerings in their country', async () => {
    const findAll = jest.spyOn(ServiceAvailability, 'findAll').mockResolvedValue([]);
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);
    await controller.listForAdmin({ user: { role: 'admin', countryId: 2 }, query: { countryId: 3 } }, res);
    expect(findAll.mock.calls[0][0].include.find((include) => include.as === 'territory').where).toEqual({ countryId: 2 });
  });

  test('partial validity updates use the dates already persisted on the offering', async () => {
    const offering = { territory: { countryId: 2 }, validFrom: new Date('2026-10-20T00:00:00Z'), validUntil: new Date('2026-11-20T00:00:00Z'), update: jest.fn() };
    jest.spyOn(ServiceAvailability, 'findByPk').mockResolvedValue(offering);
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);
    await controller.updateAvailability({ user: { role: 'admin', countryId: 2 }, params: { id: 1 }, body: { validUntil: '2026-10-10T00:00:00Z' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(offering.update).not.toHaveBeenCalled();

    const { updateServiceAvailabilitySchema } = require('../../src/validators/serviceCatalog.schemas');
    expect(updateServiceAvailabilitySchema.validate({ validUntil: '2026-12-01T00:00:00Z' }).error).toBeUndefined();
  });
});
