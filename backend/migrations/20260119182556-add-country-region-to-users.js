'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'country_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'region_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });

    await queryInterface.addIndex('users', ['country_id'], {
      name: 'idx_users_country_id',
    });

    await queryInterface.addIndex('users', ['region_id'], {
      name: 'idx_users_region_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'idx_users_region_id');
    await queryInterface.removeIndex('users', 'idx_users_country_id');
    await queryInterface.removeColumn('users', 'region_id');
    await queryInterface.removeColumn('users', 'country_id');
  },
};
