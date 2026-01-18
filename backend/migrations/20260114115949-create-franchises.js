'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('franchises', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      type: {
        type: Sequelize.ENUM('MASTER', 'REGIONAL'),
        allowNull: false,
      },
      country_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      region_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
      legal_name: {
        type: Sequelize.STRING(180),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'pending'),
        allowNull: false,
        defaultValue: 'active',
      },

      // ✅ Aligné sur ta prod (createdAt/updatedAt)
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('franchises', ['country_id'], {
      name: 'idx_franchises_country',
    });
    await queryInterface.addIndex('franchises', ['region_id'], {
      name: 'idx_franchises_region',
    });
    await queryInterface.addIndex('franchises', ['status'], {
      name: 'idx_franchises_status',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('franchises', 'idx_franchises_country');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('franchises', 'idx_franchises_region');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('franchises', 'idx_franchises_status');
    } catch (e) {}

    await queryInterface.dropTable('franchises');

    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_franchises_type";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_franchises_status";'
      );
    }
  },
};
