'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('services');

    if (!Object.prototype.hasOwnProperty.call(table, 'recipient_name')) {
      await queryInterface.addColumn('services', 'recipient_name', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(table, 'recipient_phone')) {
      await queryInterface.addColumn('services', 'recipient_phone', {
        type: Sequelize.STRING(40),
        allowNull: true,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(table, 'package_handling')) {
      await queryInterface.addColumn('services', 'package_handling', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('services');
    if (Object.prototype.hasOwnProperty.call(table, 'package_handling')) {
      await queryInterface.removeColumn('services', 'package_handling');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'recipient_phone')) {
      await queryInterface.removeColumn('services', 'recipient_phone');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'recipient_name')) {
      await queryInterface.removeColumn('services', 'recipient_name');
    }
  },
};

