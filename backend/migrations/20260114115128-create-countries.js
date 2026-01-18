'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('countries', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      iso_code: {
        type: Sequelize.STRING(2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      },
      default_language: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'fr',
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

    await queryInterface.addIndex('countries', ['iso_code'], {
      unique: true,
      name: 'uniq_countries_iso',
    });
    await queryInterface.addIndex('countries', ['is_active'], {
      name: 'idx_countries_active',
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('countries', 'uniq_countries_iso');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('countries', 'idx_countries_active');
    } catch (e) {}

    await queryInterface.dropTable('countries');
  },
};
