'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Autoriser NULL sur taskId
    await queryInterface.changeColumn('evidences', 'taskId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
    });

    // Autoriser NULL sur order_id (au cas où)
    await queryInterface.changeColumn('evidences', 'order_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revenir à NOT NULL si besoin (rollback)
    await queryInterface.changeColumn('evidences', 'taskId', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    });

    await queryInterface.changeColumn('evidences', 'order_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
    });
  },
};
