'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('properties');
    if (Object.prototype.hasOwnProperty.call(table, 'photos')) {
      return;
    }

    await queryInterface.addColumn('properties', 'photos', {
      type: Sequelize.DataTypes.JSON, // ✅ PlanetScale/MySQL supporte JSON
      allowNull: true
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('properties');
    if (!Object.prototype.hasOwnProperty.call(table, 'photos')) {
      return;
    }

    await queryInterface.removeColumn('properties', 'photos');
  }
};
