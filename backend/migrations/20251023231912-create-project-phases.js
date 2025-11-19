'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_phases', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // 🔗 Relation logique
      projectId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      },

      // 🧱 Données de la phase
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // ⏰ Dates de planification
      startDate: { type: Sequelize.DATE, allowNull: true },
      endDate: { type: Sequelize.DATE, allowNull: true },

      // 🚦 Suivi
      status: {
        type: Sequelize.ENUM('pending', 'active', 'completed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      progress: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      // 📅 Tracking
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('project_phases', ['projectId']);
    await queryInterface.addIndex('project_phases', ['status']);
    await queryInterface.addIndex('project_phases', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('project_phases', ['projectId']);
    await queryInterface.removeIndex('project_phases', ['status']);
    await queryInterface.removeIndex('project_phases', ['createdAt']);

    await queryInterface.dropTable('project_phases');

    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_project_phases_status";`
      );
    }
  },
};
