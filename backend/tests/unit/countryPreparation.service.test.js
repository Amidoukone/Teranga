'use strict';

const { prepareCountry, validatePreparation } = require('../../src/services/countryPreparation.service');
const { parseArgs } = require('../../scripts/prepare-country');

const input = { countryCode: 'ML', operator: 'Teranga', phone: '+223 70453345', currency: 'XOF', language: 'fr', timezone: 'Africa/Bamako' };

function source({ masters = [], organizations = [], territories = [], assignments = [], admins = [{ id: 37 }] } = {}) {
  const country = { id: 5, name: 'Mali', isActive: false, currency: 'XOF', defaultLanguage: 'fr', timezone: null, contactPhone: null, update: jest.fn() };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  return {
    Country: { findOne: jest.fn().mockResolvedValue(country) },
    Franchise: { findAll: jest.fn().mockResolvedValue(masters), create: jest.fn().mockResolvedValue({ id: 100 }) },
    Organization: { findAll: jest.fn().mockResolvedValue(organizations) },
    Territory: { findAll: jest.fn().mockResolvedValue(territories) },
    OrganizationTerritory: { findAll: jest.fn().mockResolvedValue(assignments) },
    User: { findAll: jest.fn().mockResolvedValue(admins) },
    sequelize: { transaction: jest.fn((run) => run(transaction)) },
    country,
    transaction,
  };
}

test('dry-run reports changes and the existing administrator without any writes', async () => {
  const db = source();
  const result = await prepareCountry(db, input);
  expect(result).toMatchObject({ mode: 'dry-run', scope: 'ML', country: { id: 5, isActive: false }, applied: false, readyToApply: true, administratorIds: [37], operator: { action: 'create' } });
  expect(result.settingsChanges).toEqual({ timezone: { from: null, to: 'Africa/Bamako' }, contactPhone: { from: null, to: '+22370453345' } });
  expect(db.sequelize.transaction).not.toHaveBeenCalled();
  expect(db.country.update).not.toHaveBeenCalled();
  expect(db.Franchise.create).not.toHaveBeenCalled();
});

test('locks the country and prepares settings and operator in the same transaction', async () => {
  const db = source();
  const result = await prepareCountry(db, input, { apply: true });
  expect(result.applied).toBe(true);
  expect(db.Country.findOne).toHaveBeenCalledWith({ where: { isoCode: 'ML' }, transaction: db.transaction, lock: 'UPDATE' });
  expect(db.country.update).toHaveBeenCalledWith({ currency: 'XOF', defaultLanguage: 'fr', timezone: 'Africa/Bamako', contactPhone: '+22370453345' }, { transaction: db.transaction });
  expect(db.Franchise.create).toHaveBeenCalledWith({ type: 'MASTER', countryId: 5, regionId: null, legalName: 'Teranga', status: 'active' }, { transaction: db.transaction });
});

test('reuses the existing operator and its projected organization', async () => {
  const db = source({ masters: [{ id: 100, legalName: 'Teranga', regionId: null, status: 'active' }], organizations: [{ id: 200, code: 'LEGACY:FRANCHISE:100' }], territories: [{ id: 300 }], assignments: [{ organizationId: 200 }] });
  const result = await prepareCountry(db, input, { apply: true });
  expect(result.operator).toMatchObject({ action: 'reuse', id: 100 });
  expect(db.Franchise.create).not.toHaveBeenCalled();
});

test.each([
  { masters: [{ id: 100 }, { id: 101 }], code: 'OPERATOR_AMBIGUOUS' },
  { masters: [{ id: 100, legalName: 'Another operator', status: 'active' }], code: 'OPERATOR_CONFLICT' },
  { masters: [{ id: 100, legalName: 'Teranga', status: 'inactive' }], code: 'OPERATOR_CONFLICT' },
  { organizations: [{ code: 'MANAGED:ORG' }], code: 'ORGANIZATION_CONFLICT' },
  { territories: [{ id: 300 }], assignments: [{ organizationId: 999 }], code: 'TERRITORY_OPERATOR_CONFLICT' },
  { admins: [], code: 'LOCAL_ADMIN_MISSING' },
])('refuses writes when preparation is ambiguous: $code', async ({ code, ...fixture }) => {
  const db = source(fixture);
  const result = await prepareCountry(db, input, { apply: true });
  expect(result.readyToApply).toBe(false);
  expect(result.applied).toBe(false);
  expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  expect(db.country.update).not.toHaveBeenCalled();
  expect(db.Franchise.create).not.toHaveBeenCalled();
});

test('never creates a missing country', async () => {
  const db = source();
  db.Country.findOne.mockResolvedValue(null);
  await expect(prepareCountry(db, input, { apply: true })).rejects.toThrow('Existing country not found: ML');
  expect(db.Franchise.create).not.toHaveBeenCalled();
});

test.each([
  { countryCode: '' }, { phone: '70453345' }, { timezone: '' },
  { timezone: 'Africa/Unknown' }, { operator: '' }, { currency: '' }, { language: '' },
])('requires explicit validated local configuration: %j', (changes) => {
  expect(() => validatePreparation({ ...input, ...changes })).toThrow();
});

test('CLI rejects unknown and duplicate options and defaults to dry-run', () => {
  expect(parseArgs(['--country=ML']).apply).toBe(false);
  expect(parseArgs(['--country=ML', '--apply']).apply).toBe(true);
  for (const args of [['--county=ML'], ['--country=ML', '--country=CI'], ['--apply', '--apply'], ['--country=']]) {
    expect(() => parseArgs(args)).toThrow();
  }
});
