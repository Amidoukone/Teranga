'use strict';

const { parseArgs, suspendOffer } = require('../../scripts/suspend-service-offer');
const args = { countryCode: 'ML', availabilityId: 1 };
function source({ countryId = 5, isActive = true } = {}) {
  const offering = { id: 1, isActive, territory: { countryId }, definition: { name: 'Electricity', code: 'TRADE:ELECTRICITY' }, update: jest.fn() };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  return {
    Country: { findOne: jest.fn().mockResolvedValue({ id: 5, name: 'Mali' }) },
    ServiceAvailability: { findByPk: jest.fn().mockResolvedValue(offering) },
    Territory: {}, ServiceDefinition: {},
    sequelize: { transaction: jest.fn((run) => run(transaction)) },
    offering, transaction,
  };
}

test('requires an explicit country and offering and defaults to read-only', () => {
  expect(parseArgs(['--country=ml', '--availability=1'])).toEqual(argsWith(false));
  expect(parseArgs(['--country=ML', '--availability=1', '--apply'])).toEqual(argsWith(true));
  for (const argv of [[], ['--country=ML'], ['--availability=1'], ['--country=ML', '--availability=0'], ['--country=ML', '--availability=1', '--apply', '--apply'], ['--country=ML', '--country=CI', '--availability=1'], ['--county=ML']]) {
    expect(() => parseArgs(argv)).toThrow();
  }
});
function argsWith(apply) { return { ...args, apply }; }

test('preview does not alter an offering', async () => {
  const db = source();
  expect(await suspendOffer(db, args)).toMatchObject({ mode: 'dry-run', applied: false, offering: { isActive: true } });
  expect(db.offering.update).not.toHaveBeenCalled();
  expect(db.sequelize.transaction).not.toHaveBeenCalled();
});

test('suspends only the matching local offering in a transaction', async () => {
  const db = source();
  expect(await suspendOffer(db, { ...args, apply: true })).toMatchObject({ applied: true, changed: true, offering: { isActive: false } });
  expect(db.offering.update).toHaveBeenCalledWith({ isActive: false }, { transaction: db.transaction });
  expect(db.ServiceAvailability.findByPk.mock.calls[0][1]).toMatchObject({ lock: 'UPDATE', transaction: db.transaction, include: [expect.objectContaining({ as: 'territory', where: { countryId: 5 } }), expect.objectContaining({ as: 'definition' })] });
});

test('cannot suspend an offering from another country', async () => {
  const db = source({ countryId: 4 });
  await expect(suspendOffer(db, { ...args, apply: true })).rejects.toThrow('selected country');
  expect(db.offering.update).not.toHaveBeenCalled();
});

test('a repeated suspension preserves all existing settings', async () => {
  const db = source({ isActive: false });
  expect(await suspendOffer(db, { ...args, apply: true })).toMatchObject({ applied: true, changed: false });
  expect(db.offering.update).not.toHaveBeenCalled();
});
