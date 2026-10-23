'use strict';

const profile = require('../../config/operating-offers/mali.json');
const { configureOperatingOffers, validateProfile } = require('../../src/services/operatingOfferConfiguration.service');
const { parseArgs } = require('../../scripts/configure-mali-offers');

function source() {
  const records = profile.offers.map((offer, index) => ({
    id: index + 1, definition: { code: offer.code, name: offer.code },
    territory: { countryId: 5, type: 'COUNTRY', regionId: null },
    isActive: true, slaMinutes: null,
    providerRules: { requiredEvidenceTypes: ['photo'], coordination: { enabled: false, acceptanceSeconds: 180 }, custom: { route: 'local' } },
    update: jest.fn(async function (patch) { Object.assign(this, patch); }),
  }));
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  return {
    Country: { findOne: jest.fn().mockResolvedValue({ id: 5, name: 'Mali' }) },
    ServiceAvailability: { findAll: jest.fn().mockResolvedValue(records) },
    Territory: {}, ServiceDefinition: {},
    sequelize: { transaction: jest.fn((run) => run(transaction)) },
    records, transaction,
  };
}

test('the approved profile targets only Mali and contains the seven accepted deadlines', () => {
  expect(() => validateProfile(profile)).not.toThrow();
  expect(profile.countryCode).toBe('ML');
  expect(profile.offers.map(({ code, slaMinutes }) => [code, slaMinutes])).toEqual([
    ['TRADE:ELECTRICITE', undefined], ['TRADE:LIVRAISON', 120], ['TRADE:MOBILITE', 60],
    ['CLASSIC:ERRAND', 240], ['CLASSIC:ADMINISTRATIVE', 1440], ['CLASSIC:PAYMENT', 120],
    ['CLASSIC:MONEY_TRANSFER', 120], ['CLASSIC:OTHER', 1440],
  ]);
  expect(parseArgs([])).toEqual({ apply: false });
  expect(parseArgs(['--apply'])).toEqual({ apply: true });
  for (const args of [['--country=CI'], ['--force'], ['--apply', '--apply']]) expect(() => parseArgs(args)).toThrow();
});

test('preview reports changes without any writes', async () => {
  const db = source();
  const result = await configureOperatingOffers(db, profile);
  expect(result).toMatchObject({ mode: 'dry-run', scope: 'ML', applied: false, summary: { readyToApply: true, offersToUpdate: 8 } });
  expect(db.sequelize.transaction).not.toHaveBeenCalled();
  for (const record of db.records) expect(record.update).not.toHaveBeenCalled();
});

test('application preserves unrelated rules and activation choices and is safe to repeat', async () => {
  const db = source();
  db.records[1].isActive = false;
  expect((await configureOperatingOffers(db, profile, { apply: true })).applied).toBe(true);
  expect(db.records[0].update).toHaveBeenCalledWith({ isActive: false }, { transaction: db.transaction });
  for (const record of db.records.slice(1)) {
    expect(record.update).toHaveBeenCalledWith({ slaMinutes: expect.any(Number), providerRules: expect.objectContaining({
      requiredEvidenceTypes: ['photo'], coordination: { enabled: false, acceptanceSeconds: 180 }, custom: { route: 'local' }, serviceOutcome: expect.any(String),
    }) }, { transaction: db.transaction });
  }
  expect(db.records[1].isActive).toBe(false);
  expect((await configureOperatingOffers(db, profile, { apply: true })).summary.offersToUpdate).toBe(0);
  for (const record of db.records) expect(record.update).toHaveBeenCalledTimes(1);
});

test.each([
  ['NATIONAL_OFFER_MISSING', (rows) => rows.splice(1, 1)],
  ['NATIONAL_OFFER_AMBIGUOUS', (rows) => rows.push({ ...rows[1], id: 100 })],
  ['OFFER_SCOPE_MISMATCH', (rows) => { rows[1].territory.countryId = 4; }],
  ['OFFER_SCOPE_MISMATCH', (rows) => { rows[1].territory.type = 'REGION'; rows[1].territory.regionId = 10; }],
  ['LOCAL_DEADLINE_CONFLICT', (rows) => { rows[1].slaMinutes = 30; }],
  ['LOCAL_OUTCOME_CONFLICT', (rows) => { rows[1].providerRules.serviceOutcome = 'A locally configured outcome'; }],
  ['LOCAL_STAGE_DEADLINE_CONFLICT', (rows) => { rows[1].providerRules.coordination.stageMinutes = 30; }],
  ['LOCAL_RULES_INVALID', (rows) => { rows[1].providerRules = 'invalid'; }],
])('blocks every write when preparation contains %s', async (code, change) => {
  const db = source();
  change(db.records);
  const result = await configureOperatingOffers(db, profile, { apply: true });
  expect(result.applied).toBe(false);
  expect(result.summary.readyToApply).toBe(false);
  expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  for (const record of db.records) expect(record.update).not.toHaveBeenCalled();
});

test('invalid profiles and missing countries cannot create records', async () => {
  const db = source();
  await expect(configureOperatingOffers(db, { countryCode: 'ML', offers: [] }, { apply: true })).rejects.toThrow();
  expect(db.Country.findOne).not.toHaveBeenCalled();
  db.Country.findOne.mockResolvedValue(null);
  await expect(configureOperatingOffers(db, profile, { apply: true })).rejects.toThrow('Country not found');
  expect(db.ServiceAvailability.findAll).not.toHaveBeenCalled();
});
