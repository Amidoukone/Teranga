'use strict';

const Sequelize = require('sequelize');
const migration = require('../../migrations/20260831120000-create-territorial-governance-foundation');
const {
  ORGANIZATION_TYPES,
  TERRITORY_TYPES,
} = require('../../src/constants/territorialGovernance');

function createQueryInterface() {
  return {
    createTable: jest.fn().mockResolvedValue(undefined),
    addIndex: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
  };
}

describe('territorial governance foundation migration', () => {
  test('creates the additive tables in dependency order', async () => {
    const queryInterface = createQueryInterface();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable.mock.calls.map(([table]) => table)).toEqual([
      'organizations',
      'territories',
      'organization_territories',
      'memberships',
    ]);

    const organizations = queryInterface.createTable.mock.calls[0][1];
    const territories = queryInterface.createTable.mock.calls[1][1];
    const memberships = queryInterface.createTable.mock.calls[3][1];

    expect(organizations.type.type.values).toEqual(ORGANIZATION_TYPES);
    expect(organizations.parent_organization_id.allowNull).toBe(true);
    expect(territories.type.type.values).toEqual(TERRITORY_TYPES);
    expect(territories.country_id.allowNull).toBe(false);
    expect(memberships.user_id.type.toString()).toContain('INTEGER');
    expect(memberships.organization_id.type.toString()).toContain('BIGINT');
  });

  test('defines the uniqueness and scope indexes needed for safe projection', async () => {
    const queryInterface = createQueryInterface();

    await migration.up(queryInterface, Sequelize);

    const indexes = queryInterface.addIndex.mock.calls.map(
      ([table, fields, options]) => ({ table, fields, ...options })
    );

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'organizations',
          fields: ['code'],
          unique: true,
        }),
        expect.objectContaining({
          table: 'territories',
          fields: ['code'],
          unique: true,
        }),
        expect.objectContaining({
          table: 'organization_territories',
          fields: ['organization_id', 'territory_id'],
          unique: true,
        }),
        expect.objectContaining({
          table: 'memberships',
          fields: ['organization_id', 'territory_id', 'status'],
        }),
      ])
    );
  });

  test('drops tables in reverse dependency order', async () => {
    const queryInterface = createQueryInterface();

    await migration.down(queryInterface);

    expect(queryInterface.dropTable.mock.calls.map(([table]) => table)).toEqual([
      'memberships',
      'organization_territories',
      'territories',
      'organizations',
    ]);
  });
});
