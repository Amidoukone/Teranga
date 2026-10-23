'use strict';

process.env.NODE_ENV = 'test';
const crypto = require('crypto');
const db = require('../../models');
const approved = require('../../config/operating-offers/mali.json');
const { configureOperatingOffers } = require('../../src/services/operatingOfferConfiguration.service');

let country, foreign, region, regional, foreignOffering, profile;
const countries = [], territories = [], organizations = [], definitions = [], offerings = [];
const national = [];

beforeAll(async () => {
  if (db.sequelize.config.database !== (process.env.DB_NAME_TEST || 'teranga_test') || !['localhost', '127.0.0.1', '::1'].includes(db.sequelize.config.host)) throw new Error('Offer configuration integration requires a local test database');
  await db.sequelize.authenticate();
  async function makeCountry(currency) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const row = await db.Country.create({ name: `Offers-${crypto.randomUUID()}`, isoCode: String.fromCharCode(65 + crypto.randomInt(26), 65 + crypto.randomInt(26)), currency, timezone: 'Africa/Accra', isActive: false });
        countries.push(row); return row;
      } catch (error) { if (error.name !== 'SequelizeUniqueConstraintError') throw error; }
    }
    throw new Error('Offer country fixture unavailable');
  }
  country = await makeCountry('GHS'); foreign = await makeCountry('USD');
  const prefix = `OFFER-${crypto.randomUUID()}`;
  for (const local of [country, foreign]) {
    territories.push(await db.Territory.create({ code: `${prefix}-${local.id}`, name: 'Test country territory', type: 'COUNTRY', countryId: local.id }));
    organizations.push(await db.Organization.create({ code: `${prefix}-${local.id}`, type: 'MASTER', countryId: local.id, legalName: 'Test operator', status: 'active' }));
  }
  region = await db.Region.create({ countryId: country.id, name: 'Test region', code: prefix.slice(-8) });
  territories.push(await db.Territory.create({ code: `${prefix}-region`, name: 'Test regional territory', type: 'REGION', countryId: country.id, regionId: region.id, parentId: territories[0].id }));
  profile = { countryCode: country.isoCode, offers: approved.offers.map((offer, index) => ({ ...offer, code: `${prefix.toUpperCase()}:${index}` })) };
  for (const entry of profile.offers) {
    const definition = await db.ServiceDefinition.create({ code: entry.code, name: 'Fixture offering', executionProfile: 'agent' });
    definitions.push(definition);
    const row = await db.ServiceAvailability.create({ serviceDefinitionId: definition.id, territoryId: territories[0].id, organizationId: organizations[0].id, currency: 'GHS', basePrice: 1234, isActive: national.length !== 1,
      providerRules: { coordination: { enabled: false, acceptanceSeconds: 180 }, requiredEvidenceTypes: ['photo'], custom: 'preserve' } });
    national.push(row); offerings.push(row);
  }
  regional = await db.ServiceAvailability.create({ serviceDefinitionId: definitions[1].id, territoryId: territories[2].id, organizationId: organizations[0].id, currency: 'GHS', slaMinutes: 45, providerRules: { serviceOutcome: 'Regional settings must remain unchanged' } }); offerings.push(regional);
  foreignOffering = await db.ServiceAvailability.create({ serviceDefinitionId: definitions[1].id, territoryId: territories[1].id, organizationId: organizations[1].id, currency: 'USD', slaMinutes: 90, providerRules: { serviceOutcome: 'Foreign settings must remain unchanged' } }); offerings.push(foreignOffering);
});

afterAll(async () => {
  jest.restoreAllMocks();
  for (const row of offerings) await row.destroy();
  for (const row of definitions) await row.destroy();
  for (const row of [...territories].reverse()) await row.destroy();
  for (const row of organizations) await row.destroy();
  if (region) await region.destroy();
  for (const row of countries) await row.destroy();
  await db.sequelize.close();
});

test('approved configuration is atomic, repeatable and isolated from regions and other countries', async () => {
  const original = await Promise.all(national.map(async (row) => (await row.reload()).toJSON()));
  const regionalOriginal = (await regional.reload()).toJSON();
  const foreignOriginal = (await foreignOffering.reload()).toJSON();
  expect((await configureOperatingOffers(db, profile)).summary.readyToApply).toBe(true);
  expect(await Promise.all(national.map(async (row) => (await row.reload()).toJSON()))).toEqual(original);

  const update = db.ServiceAvailability.prototype.update;
  const failure = jest.spyOn(db.ServiceAvailability.prototype, 'update').mockImplementation(function (values, options) {
    if (String(this.id) === String(national[1].id)) throw new Error('Simulated offer write failure');
    return update.call(this, values, options);
  });
  try { await expect(configureOperatingOffers(db, profile, { apply: true })).rejects.toThrow('Simulated offer write failure'); }
  finally { failure.mockRestore(); }
  expect(await Promise.all(national.map(async (row) => (await row.reload()).toJSON()))).toEqual(original);

  expect(await configureOperatingOffers(db, profile, { apply: true })).toMatchObject({ applied: true, summary: { offersToUpdate: 8, blockingIssues: 0 } });
  for (let index = 0; index < national.length; index += 1) {
    const row = await national[index].reload();
    expect(row.currency).toBe('GHS'); expect(Number(row.basePrice)).toBe(1234);
    expect(row.providerRules.coordination).toEqual({ enabled: false, acceptanceSeconds: 180 });
    expect(row.providerRules.requiredEvidenceTypes).toEqual(['photo']);
    expect(row.providerRules.custom).toBe('preserve');
    if (!index) { expect(row.isActive).toBe(false); expect(row.slaMinutes).toBeNull(); }
    else {
      expect(row.slaMinutes).toBe(profile.offers[index].slaMinutes);
      expect(row.providerRules.serviceOutcome).toBe(profile.offers[index].serviceOutcome);
      expect(row.isActive).toBe(original[index].isActive);
    }
  }
  const applied = await Promise.all(national.map(async (row) => row.toJSON()));
  expect((await configureOperatingOffers(db, profile, { apply: true })).summary.offersToUpdate).toBe(0);
  expect(await Promise.all(national.map(async (row) => (await row.reload()).toJSON()))).toEqual(applied);
  expect((await regional.reload()).toJSON()).toEqual(regionalOriginal);
  expect((await foreignOffering.reload()).toJSON()).toEqual(foreignOriginal);
  expect((await country.reload()).isActive).toBe(false);
});
