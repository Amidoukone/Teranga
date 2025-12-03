"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("services", "propertyId", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("services", "propertyId", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    });
  },
};
