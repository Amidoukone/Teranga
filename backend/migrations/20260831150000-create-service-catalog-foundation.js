'use strict';

const {
  SERVICE_FAMILIES,
  EXECUTION_PROFILES,
} = require('../src/constants/serviceCatalog');

const timestamps = (Sequelize) => ({
  created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
  updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('service_definitions', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      code: { type: Sequelize.STRING(120), allowNull: false },
      name: { type: Sequelize.STRING(180), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      family: {
        type: Sequelize.ENUM(...SERVICE_FAMILIES),
        allowNull: false,
        defaultValue: 'core',
      },
      execution_profile: {
        type: Sequelize.ENUM(...EXECUTION_PROFILES),
        allowNull: false,
      },
      legacy_trade_category_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      legacy_service_type: { type: Sequelize.STRING(50), allowNull: true },
      required_evidence_types: { type: Sequelize.JSON, allowNull: true },
      intake_schema: { type: Sequelize.JSON, allowNull: true },
      version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('service_definitions', ['code'], {
      unique: true,
      name: 'uniq_service_definitions_code',
    });
    await queryInterface.addIndex('service_definitions', ['legacy_trade_category_id'], {
      name: 'idx_service_definitions_legacy_trade_category',
    });
    await queryInterface.addIndex('service_definitions', ['legacy_service_type'], {
      name: 'idx_service_definitions_legacy_service_type',
    });
    await queryInterface.addIndex('service_definitions', ['family', 'is_active'], {
      name: 'idx_service_definitions_family_active',
    });

    await queryInterface.createTable('service_availabilities', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      service_definition_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      territory_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      organization_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      currency: { type: Sequelize.STRING(10), allowNull: false },
      base_price: { type: Sequelize.DECIMAL(14, 2), allowNull: true },
      sla_minutes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      opening_hours: { type: Sequelize.JSON, allowNull: true },
      required_fields: { type: Sequelize.JSON, allowNull: true },
      provider_rules: { type: Sequelize.JSON, allowNull: true },
      version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      valid_from: { type: Sequelize.DATE, allowNull: true },
      valid_until: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex(
      'service_availabilities',
      ['service_definition_id', 'territory_id', 'organization_id'],
      { unique: true, name: 'uniq_service_availability_scope' }
    );
    await queryInterface.addIndex('service_availabilities', ['territory_id', 'is_active'], {
      name: 'idx_service_availabilities_territory_active',
    });
    await queryInterface.addIndex('service_availabilities', ['organization_id', 'is_active'], {
      name: 'idx_service_availabilities_organization_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('service_availabilities');
    await queryInterface.dropTable('service_definitions');
  },
};
