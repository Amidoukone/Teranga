'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('projects', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // 🔗 Relations utilisateurs
      clientId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      agentId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // 🧱 Données principales
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING(100),
        allowNull: false, // ex: immobilier, agricole, administratif, etc.
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 💰 Budget & devises
      budget: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      },

      // 🚦 Statut du projet
      status: {
        type: Sequelize.ENUM('created', 'in_progress', 'completed', 'validated'),
        allowNull: false,
        defaultValue: 'created',
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

    // Index utiles pour filtrage & ACL
    await queryInterface.addIndex('projects', ['clientId']);
    await queryInterface.addIndex('projects', ['agentId']);
    await queryInterface.addIndex('projects', ['status']);
    await queryInterface.addIndex('projects', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('projects', ['clientId']);
    await queryInterface.removeIndex('projects', ['agentId']);
    await queryInterface.removeIndex('projects', ['status']);
    await queryInterface.removeIndex('projects', ['createdAt']);

    await queryInterface.dropTable('projects');

    // Nettoyage ENUM (PostgreSQL)
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_projects_status";`);
    }
  },
};
