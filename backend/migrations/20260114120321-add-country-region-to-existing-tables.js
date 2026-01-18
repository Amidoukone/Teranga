'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * ============================================================
     * 🌍 GEO-SCOPE : tables métier (camelCase)
     * ============================================================
     */

    // properties
    await queryInterface.addColumn('properties', 'countryId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addColumn('properties', 'regionId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('properties', ['countryId'], {
      name: 'idx_properties_countryId',
    });
    await queryInterface.addIndex('properties', ['regionId'], {
      name: 'idx_properties_regionId',
    });

    // services
    await queryInterface.addColumn('services', 'countryId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addColumn('services', 'regionId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('services', ['countryId'], {
      name: 'idx_services_countryId',
    });
    await queryInterface.addIndex('services', ['regionId'], {
      name: 'idx_services_regionId',
    });

    // tasks
    await queryInterface.addColumn('tasks', 'countryId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addColumn('tasks', 'regionId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('tasks', ['countryId'], {
      name: 'idx_tasks_countryId',
    });
    await queryInterface.addIndex('tasks', ['regionId'], {
      name: 'idx_tasks_regionId',
    });

    // evidences
    await queryInterface.addColumn('evidences', 'countryId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addColumn('evidences', 'regionId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('evidences', ['countryId'], {
      name: 'idx_evidences_countryId',
    });
    await queryInterface.addIndex('evidences', ['regionId'], {
      name: 'idx_evidences_regionId',
    });

    // transactions
    await queryInterface.addColumn('transactions', 'countryId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addColumn('transactions', 'regionId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('transactions', ['countryId'], {
      name: 'idx_transactions_countryId',
    });
    await queryInterface.addIndex('transactions', ['regionId'], {
      name: 'idx_transactions_regionId',
    });

    // projects
    await queryInterface.addColumn('projects', 'countryId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addColumn('projects', 'regionId', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('projects', ['countryId'], {
      name: 'idx_projects_countryId',
    });
    await queryInterface.addIndex('projects', ['regionId'], {
      name: 'idx_projects_regionId',
    });

    /**
     * ============================================================
     * 🌍 GEO-SCOPE : tables commerce (snake_case)
     * ============================================================
     */

    // products
    await queryInterface.addColumn('products', 'country_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addColumn('products', 'region_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('products', ['country_id'], {
      name: 'idx_products_country_id',
    });
    await queryInterface.addIndex('products', ['region_id'], {
      name: 'idx_products_region_id',
    });

    // orders
    await queryInterface.addColumn('orders', 'country_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'region_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await queryInterface.addIndex('orders', ['country_id'], {
      name: 'idx_orders_country_id',
    });
    await queryInterface.addIndex('orders', ['region_id'], {
      name: 'idx_orders_region_id',
    });
  },

  async down(queryInterface) {
    /**
     * ============================================================
     * 🔙 ROLLBACK STRICT (ordre inverse, index exacts)
     * ============================================================
     */

    // orders
    await queryInterface.removeIndex('orders', 'idx_orders_region_id');
    await queryInterface.removeIndex('orders', 'idx_orders_country_id');
    await queryInterface.removeColumn('orders', 'region_id');
    await queryInterface.removeColumn('orders', 'country_id');

    // products
    await queryInterface.removeIndex('products', 'idx_products_region_id');
    await queryInterface.removeIndex('products', 'idx_products_country_id');
    await queryInterface.removeColumn('products', 'region_id');
    await queryInterface.removeColumn('products', 'country_id');

    // projects
    await queryInterface.removeIndex('projects', 'idx_projects_regionId');
    await queryInterface.removeIndex('projects', 'idx_projects_countryId');
    await queryInterface.removeColumn('projects', 'regionId');
    await queryInterface.removeColumn('projects', 'countryId');

    // transactions
    await queryInterface.removeIndex('transactions', 'idx_transactions_regionId');
    await queryInterface.removeIndex('transactions', 'idx_transactions_countryId');
    await queryInterface.removeColumn('transactions', 'regionId');
    await queryInterface.removeColumn('transactions', 'countryId');

    // evidences
    await queryInterface.removeIndex('evidences', 'idx_evidences_regionId');
    await queryInterface.removeIndex('evidences', 'idx_evidences_countryId');
    await queryInterface.removeColumn('evidences', 'regionId');
    await queryInterface.removeColumn('evidences', 'countryId');

    // tasks
    await queryInterface.removeIndex('tasks', 'idx_tasks_regionId');
    await queryInterface.removeIndex('tasks', 'idx_tasks_countryId');
    await queryInterface.removeColumn('tasks', 'regionId');
    await queryInterface.removeColumn('tasks', 'countryId');

    // services
    await queryInterface.removeIndex('services', 'idx_services_regionId');
    await queryInterface.removeIndex('services', 'idx_services_countryId');
    await queryInterface.removeColumn('services', 'regionId');
    await queryInterface.removeColumn('services', 'countryId');

    // properties
    await queryInterface.removeIndex('properties', 'idx_properties_regionId');
    await queryInterface.removeIndex('properties', 'idx_properties_countryId');
    await queryInterface.removeColumn('properties', 'regionId');
    await queryInterface.removeColumn('properties', 'countryId');
  },
};
