'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks', 'projectId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true
      // ❌ Pas de REFERENCES / onDelete / onUpdate sur PlanetScale
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tasks', 'projectId');
  },
};
