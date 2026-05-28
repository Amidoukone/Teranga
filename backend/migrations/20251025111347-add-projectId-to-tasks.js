'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks', 'projectId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true
      // Pas de REFERENCES / onDelete / onUpdate pour rester portable.
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tasks', 'projectId');
  },
};
