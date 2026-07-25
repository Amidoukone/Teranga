'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Idempotent : create-users.js (20250924090000) inclut déjà country_id
    // et region_id depuis une modification ultérieure de cette migration
    // antérieure (même pattern que phaseId sur project_documents).
    const table = await queryInterface.describeTable('users');

    if (!Object.prototype.hasOwnProperty.call(table, 'country_id')) {
      await queryInterface.addColumn('users', 'country_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'region_id')) {
      await queryInterface.addColumn('users', 'region_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('users');
    const existingNames = new Set(indexes.map((idx) => idx.name));

    if (!existingNames.has('idx_users_country_id')) {
      await queryInterface.addIndex('users', ['country_id'], {
        name: 'idx_users_country_id',
      });
    }

    if (!existingNames.has('idx_users_region_id')) {
      await queryInterface.addIndex('users', ['region_id'], {
        name: 'idx_users_region_id',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('users');
    const existingNames = new Set(indexes.map((idx) => idx.name));

    if (existingNames.has('idx_users_region_id')) {
      await queryInterface.removeIndex('users', 'idx_users_region_id');
    }
    if (existingNames.has('idx_users_country_id')) {
      await queryInterface.removeIndex('users', 'idx_users_country_id');
    }

    const table = await queryInterface.describeTable('users');
    if (Object.prototype.hasOwnProperty.call(table, 'region_id')) {
      await queryInterface.removeColumn('users', 'region_id');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'country_id')) {
      await queryInterface.removeColumn('users', 'country_id');
    }
  },
};
