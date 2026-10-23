'use strict';

process.env.NODE_ENV = 'test';
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../../models');
const { prepareCountry } = require('../../src/services/countryPreparation.service');
const { loadLegacyProjection } = require('../../src/services/territorialProjection.service');

let country, foreign, admin;
beforeAll(async () => {
  const expected = process.env.DB_NAME_TEST || 'teranga_test';
  if (db.sequelize.config.database !== expected || !['localhost', '127.0.0.1', '::1'].includes(db.sequelize.config.host)) {
    throw new Error('Country preparation integration requires a local test database');
  }
  await db.sequelize.authenticate();
  async function createCountry() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        return await db.Country.create({ name: `Preparation-${crypto.randomUUID()}`, isoCode: String.fromCharCode(65 + crypto.randomInt(26), 65 + crypto.randomInt(26)), currency: 'XOF', timezone: null, contactPhone: null, isActive: false });
      } catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
    }
    throw new Error('Country preparation fixture unavailable');
  }
  country = await createCountry(); foreign = await createCountry();
  admin = await db.User.create({ role: 'admin', countryId: country.id, email: `preparation-${crypto.randomUUID()}@example.test`, passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10) });
});

afterAll(async () => {
  if (admin) await admin.destroy();
  if (country) { await db.Franchise.destroy({ where: { countryId: country.id } }); await country.destroy(); }
  if (foreign) await foreign.destroy();
  await db.sequelize.close();
});

test('preparation rolls back on failure, is safe to repeat concurrently and preserves existing data', async () => {
  const input = { countryCode: country.isoCode, operator: 'Teranga', phone: '+223 70453345', currency: 'XOF', language: 'fr', timezone: 'Africa/Bamako' };
  const original = (await country.reload()).toJSON();
  const foreignOriginal = (await foreign.reload()).toJSON();
  const preview = await prepareCountry(db, input);
  expect(preview.readyToApply).toBe(true);
  expect((await country.reload()).toJSON()).toEqual(original);
  expect(await db.Franchise.count({ where: { countryId: country.id } })).toBe(0);

  const failedDb = { ...db, Franchise: {
    findAll: db.Franchise.findAll.bind(db.Franchise),
    create: async () => { throw new Error('Simulated operator storage failure'); },
  } };
  await expect(prepareCountry(failedDb, input, { apply: true })).rejects.toThrow('Simulated operator storage failure');
  expect((await country.reload()).toJSON()).toEqual(original);

  const results = await Promise.all([prepareCountry(db, input, { apply: true }), prepareCountry(db, input, { apply: true })]);
  expect(results.every((result) => result.applied)).toBe(true);
  expect(results.map((result) => result.operator.action).sort()).toEqual(['create', 'reuse']);
  expect(await db.Franchise.count({ where: { countryId: country.id } })).toBe(1);
  const repeated = await prepareCountry(db, input, { apply: true });
  expect(repeated.settingsChanges).toEqual({});
  expect(repeated.operator.action).toBe('reuse');
  expect((await country.reload()).toJSON()).toMatchObject({ id: original.id, isActive: false, timezone: 'Africa/Bamako', contactPhone: '+22370453345' });
  expect((await foreign.reload()).toJSON()).toEqual(foreignOriginal);
  expect((await admin.reload()).countryId).toBe(country.id);
  expect((await loadLegacyProjection(db, { countryCode: country.isoCode })).summary.readyToApply).toBe(true);
});
