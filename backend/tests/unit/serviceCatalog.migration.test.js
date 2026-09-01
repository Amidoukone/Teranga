'use strict';

const Sequelize = require('sequelize');
const migration = require('../../migrations/20260831150000-create-service-catalog-foundation');
const {
  SERVICE_FAMILIES,
  EXECUTION_PROFILES,
} = require('../../src/constants/serviceCatalog');

function createQueryInterface() {
  return {
    createTable: jest.fn().mockResolvedValue(undefined),
    addIndex: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
  };
}

describe('service catalog foundation migration', () => {
  test('creates definitions before their local availabilities', async () => {
    const queryInterface = createQueryInterface();
    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable.mock.calls.map(([table]) => table)).toEqual([
      'service_definitions',
      'service_availabilities',
    ]);
    const definitions = queryInterface.createTable.mock.calls[0][1];
    const availabilities = queryInterface.createTable.mock.calls[1][1];
    expect(definitions.family.type.values).toEqual(SERVICE_FAMILIES);
    expect(definitions.execution_profile.type.values).toEqual(EXECUTION_PROFILES);
    expect(availabilities.territory_id.allowNull).toBe(false);
    expect(availabilities.organization_id.allowNull).toBe(false);
  });

  test('enforces one offering per definition, territory and operator', async () => {
    const queryInterface = createQueryInterface();
    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addIndex.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'service_availabilities',
          ['service_definition_id', 'territory_id', 'organization_id'],
          expect.objectContaining({ unique: true }),
        ],
      ])
    );
  });

  test('drops the additive tables in reverse dependency order', async () => {
    const queryInterface = createQueryInterface();
    await migration.down(queryInterface);
    expect(queryInterface.dropTable.mock.calls.map(([table]) => table)).toEqual([
      'service_availabilities',
      'service_definitions',
    ]);
  });
});
