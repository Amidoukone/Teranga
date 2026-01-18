'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('regions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      country_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('regions', ['country_id'], {
      name: 'idx_regions_country',
    });
    await queryInterface.addIndex('regions', ['is_active'], {
      name: 'idx_regions_active',
    });

    /**
     * ✅ Sécurité multi-pays:
     * - Empêche ambiguïté sur code ('BKO', etc.)
     * - Un code de région peut exister dans différents pays, mais pas 2 fois
     *   dans le même pays.
     */
    await queryInterface.addIndex('regions', ['country_id', 'code'], {
      unique: true,
      name: 'uniq_regions_country_code',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('regions', 'uniq_regions_country_code');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('regions', 'idx_regions_country');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('regions', 'idx_regions_active');
    } catch (e) {}

    await queryInterface.dropTable('regions');
  },
};
