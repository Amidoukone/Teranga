'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('properties', 'photos', {
      type: Sequelize.DataTypes.JSON, // ✅ PlanetScale/MySQL supporte JSON
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('properties', 'photos');
  }
};
