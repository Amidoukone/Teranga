'use strict';

const { Franchise, Country } = require('../../models');
const controller = require('../../src/controllers/franchise.controller');

function response() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const admin = { role: 'admin', isGlobalAdmin: true };

afterEach(() => jest.restoreAllMocks());

test('cannot create a second active national operator', async () => {
  jest.spyOn(Country, 'findByPk').mockResolvedValue({ id: 2 });
  jest.spyOn(Franchise, 'findOne').mockResolvedValue({ id: 10 });
  const create = jest.spyOn(Franchise, 'create');
  const res = response();

  await controller.create({ user: admin, body: {
    type: 'MASTER', countryId: 2, legalName: 'Teranga CI', status: 'active',
  } }, res);

  expect(res.status).toHaveBeenCalledWith(409);
  expect(create).not.toHaveBeenCalled();
});

test('cannot activate another national operator in the same country', async () => {
  const franchise = {
    id: 11, type: 'MASTER', countryId: 2, regionId: null, status: 'inactive',
    save: jest.fn(),
  };
  jest.spyOn(Franchise, 'findByPk').mockResolvedValue(franchise);
  jest.spyOn(Franchise, 'findOne').mockResolvedValue({ id: 10 });
  const res = response();

  await controller.update({ user: admin, params: { id: 11 }, body: { status: 'active' } }, res);

  expect(res.status).toHaveBeenCalledWith(409);
  expect(franchise.save).not.toHaveBeenCalled();
});
