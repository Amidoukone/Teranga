'use strict';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((table) =>
      String(typeof table === 'object' ? table.tableName || table.name : table).toLowerCase()
    );

    if (!tables.includes('provider_live_locations')) {
      await queryInterface.createTable('provider_live_locations', {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        provider_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'providers', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        vehicle_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'vehicles', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
        longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
        accuracy_meters: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
        heading_degrees: { type: Sequelize.DECIMAL(6, 2), allowNull: true },
        recorded_at: { type: Sequelize.DATE, allowNull: false },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      });
    }

    const indexes = await queryInterface.showIndex('provider_live_locations');
    const definitions = [
      {
        name: 'uniq_provider_live_locations_provider',
        fields: ['provider_id'],
        unique: true,
      },
      { name: 'idx_provider_live_locations_vehicle', fields: ['vehicle_id'] },
      { name: 'idx_provider_live_locations_recorded', fields: ['recorded_at'] },
      {
        name: 'idx_provider_live_locations_coordinates',
        fields: ['latitude', 'longitude'],
      },
    ];
    for (const definition of definitions) {
      if (!indexes.some((index) => index.name === definition.name)) {
        await queryInterface.addIndex('provider_live_locations', definition.fields, {
          name: definition.name,
          unique: Boolean(definition.unique),
        });
      }
    }

    // Garde de reprise : confirme que les deux FK fonctionnelles existent avant de terminer.
    const columns = await queryInterface.describeTable('provider_live_locations');
    if (!hasOwn(columns, 'provider_id') || !hasOwn(columns, 'vehicle_id')) {
      throw new Error('provider_live_locations incomplet');
    }
  },

  async down(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((table) =>
      String(typeof table === 'object' ? table.tableName || table.name : table).toLowerCase()
    );
    if (tables.includes('provider_live_locations')) {
      await queryInterface.dropTable('provider_live_locations');
    }
  },
};
