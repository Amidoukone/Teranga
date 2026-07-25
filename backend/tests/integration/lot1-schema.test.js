'use strict';

/**
 * Vérifie la couche DB du Lot 1 (docs/DEV_SPEC_TERANGA_v3.md) : ENUM
 * users.role étendu, colonnes additives sur services, nouvelles tables
 * providers/trade_categories/provider_trade_categories/mission_status_history
 * avec leurs contraintes FK physiques, et associations Sequelize navigables.
 *
 * Suit le pattern dbReady de critical-flows.test.js : si aucune base de test
 * n'est joignable, les assertions dépendant de la DB sont sautées plutôt que
 * de faire échouer la suite (ex. environnement local sans MySQL).
 */

const db = require('../../models');

let dbReady = false;
const created = {
  countryIds: [],
  userIds: [],
  providerIds: [],
  tradeCategoryIds: [],
};

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    const tables = await db.sequelize.getQueryInterface().showAllTables();
    return Array.isArray(tables) && tables.length > 0;
  } catch (_err) {
    return false;
  }
}

async function getForeignKeys(tableName) {
  const [rows] = await db.sequelize.query(
    `
    SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `,
    { replacements: [tableName] }
  );
  return rows;
}

describe('Lot 1 — schéma DB Teranga v3 (roles, missionStatus, providers, trade_categories)', () => {
  beforeAll(async () => {
    dbReady = await checkDatabase();
  });

  afterAll(async () => {
    if (dbReady) {
      if (created.providerIds.length) {
        await db.ProviderTradeCategory.destroy({ where: { providerId: created.providerIds } });
        await db.Provider.destroy({ where: { id: created.providerIds } });
      }
      if (created.tradeCategoryIds.length) {
        await db.TradeCategory.destroy({ where: { id: created.tradeCategoryIds } });
      }
      if (created.userIds.length) {
        await db.User.destroy({ where: { id: created.userIds } });
      }
      if (created.countryIds.length) {
        await db.Country.destroy({ where: { id: created.countryIds } });
      }
      await db.sequelize.close();
    }
  });

  test('users.role ENUM accepte provider et category_manager', async () => {
    if (!dbReady) return;

    const table = await db.sequelize.getQueryInterface().describeTable('users');
    expect(table.role.type).toEqual(expect.stringContaining('provider'));
    expect(table.role.type).toEqual(expect.stringContaining('category_manager'));
  });

  test('services porte les nouvelles colonnes additives du Lot 1', async () => {
    if (!dbReady) return;

    const table = await db.sequelize.getQueryInterface().describeTable('services');
    ['executionType', 'providerId', 'tradeCategoryId', 'missionStatus', 'warrantyExpiresAt'].forEach(
      (col) => {
        expect(table).toHaveProperty(col);
      }
    );
    // status legacy toujours présent et inchangé (pas remplacé par missionStatus)
    expect(table).toHaveProperty('status');
  });

  test('trade_categories, providers, provider_trade_categories, mission_status_history existent', async () => {
    if (!dbReady) return;

    const tables = await db.sequelize.getQueryInterface().showAllTables();
    const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName));
    ['trade_categories', 'providers', 'provider_trade_categories', 'mission_status_history'].forEach(
      (t) => {
        expect(normalized).toContain(t);
      }
    );
  });

  test('providers porte les FK physiques attendues (user_id, country_code)', async () => {
    if (!dbReady) return;

    const fks = await getForeignKeys('providers');
    const byColumn = Object.fromEntries(fks.map((fk) => [fk.COLUMN_NAME, fk]));

    expect(byColumn.user_id).toBeDefined();
    expect(byColumn.user_id.REFERENCED_TABLE_NAME).toBe('users');

    expect(byColumn.country_code).toBeDefined();
    expect(byColumn.country_code.REFERENCED_TABLE_NAME).toBe('countries');
    expect(byColumn.country_code.REFERENCED_COLUMN_NAME).toBe('iso_code');
  });

  test('provider_trade_categories et mission_status_history portent leurs FK physiques', async () => {
    if (!dbReady) return;

    const ptcFks = await getForeignKeys('provider_trade_categories');
    expect(ptcFks.some((fk) => fk.REFERENCED_TABLE_NAME === 'providers')).toBe(true);
    expect(ptcFks.some((fk) => fk.REFERENCED_TABLE_NAME === 'trade_categories')).toBe(true);

    const mshFks = await getForeignKeys('mission_status_history');
    expect(mshFks.some((fk) => fk.REFERENCED_TABLE_NAME === 'services')).toBe(true);
    expect(mshFks.some((fk) => fk.REFERENCED_TABLE_NAME === 'users')).toBe(true);
  });

  test('services ne porte AUCUNE FK physique vers providers/trade_categories (association logique seulement)', async () => {
    if (!dbReady) return;

    const fks = await getForeignKeys('services');
    expect(fks.some((fk) => fk.REFERENCED_TABLE_NAME === 'providers')).toBe(false);
    expect(fks.some((fk) => fk.REFERENCED_TABLE_NAME === 'trade_categories')).toBe(false);
  });

  test('associations Sequelize Provider <-> TradeCategory <-> User sont navigables', async () => {
    if (!dbReady) return;

    const country = await db.Country.create({
      name: `IT-Lot1-${Date.now()}`,
      isoCode: 'Z' + String.fromCharCode(65 + Math.floor(Math.random() * 26)),
      isActive: true,
    });
    created.countryIds.push(country.id);

    const user = await db.User.create({
      email: `it-provider-${Date.now()}@example.com`,
      passwordHash: 'x',
      role: 'provider',
    });
    created.userIds.push(user.id);

    const tradeCategory = await db.TradeCategory.create({
      name: `IT-Filiere-${Date.now()}`,
      slug: `it-filiere-${Date.now()}`,
    });
    created.tradeCategoryIds.push(tradeCategory.id);

    const provider = await db.Provider.create({
      userId: user.id,
      type: 'independent',
      displayFirstName: 'Testeur',
      phoneNumber: '+22300000000',
      countryCode: country.isoCode,
    });
    created.providerIds.push(provider.id);

    await provider.addTradeCategory(tradeCategory);

    const reloaded = await db.Provider.findByPk(provider.id, {
      include: [{ model: db.User, as: 'user' }, { model: db.TradeCategory, as: 'tradeCategories' }],
    });

    expect(reloaded.user.id).toBe(user.id);
    expect(reloaded.tradeCategories.map((tc) => tc.id)).toContain(tradeCategory.id);
    expect(reloaded.toPublicDTO()).not.toHaveProperty('phoneNumber');
    expect(reloaded.toPublicDTO()).not.toHaveProperty('email');
    expect(reloaded.toPublicDTO()).not.toHaveProperty('legalName');
  });
});
