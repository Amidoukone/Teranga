'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('countries');
    if (!Object.prototype.hasOwnProperty.call(columns, 'timezone')) {
      await queryInterface.addColumn('countries', 'timezone', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }
    const regionColumns = await queryInterface.describeTable('regions');
    if (!Object.prototype.hasOwnProperty.call(regionColumns, 'timezone')) {
      await queryInterface.addColumn('regions', 'timezone', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const regionColumns = await queryInterface.describeTable('regions');
    if (Object.prototype.hasOwnProperty.call(regionColumns, 'timezone')) {
      await queryInterface.removeColumn('regions', 'timezone');
    }
    const columns = await queryInterface.describeTable('countries');
    if (Object.prototype.hasOwnProperty.call(columns, 'timezone')) {
      await queryInterface.removeColumn('countries', 'timezone');
    }
  },
};
