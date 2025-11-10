'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },

      // 🔗 Relations
      serviceId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'services', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      propertyId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'properties', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      creatorId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      assignedTo: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },

      // 📝 Infos principales
      type: {
        type: Sequelize.ENUM(
          'repair', 
          'visit', 
          'administrative', 
          'shopping', 
          'other'
        ),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      // 🚦 Suivi & workflow
      priority: {
        type: Sequelize.ENUM('normal', 'urgent', 'critical'),
        allowNull: false,
        defaultValue: 'normal'
      },
      status: {
        type: Sequelize.ENUM(
          'created',
          'in_progress',
          'completed',
          'validated',
          'cancelled'
        ),
        allowNull: false,
        defaultValue: 'created'
      },

      // 💰 Budget & coûts
      estimatedCost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      actualCost: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },

      // ⏰ Dates
      dueDate: { type: Sequelize.DATE, allowNull: true },
      completedAt: { type: Sequelize.DATE, allowNull: true },

      // 📅 Tracking
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Index utiles (pour les filtres)
    await queryInterface.addIndex('tasks', ['serviceId']);
    await queryInterface.addIndex('tasks', ['propertyId']);
    await queryInterface.addIndex('tasks', ['creatorId']);
    await queryInterface.addIndex('tasks', ['assignedTo']);
    await queryInterface.addIndex('tasks', ['status']);
    await queryInterface.addIndex('tasks', ['priority']);
    await queryInterface.addIndex('tasks', ['createdAt']);
  },

  async down(queryInterface) {
    // ⚠️ Supprimer d’abord les index et ENUMs pour éviter conflits
    await queryInterface.removeIndex('tasks', ['serviceId']);
    await queryInterface.removeIndex('tasks', ['propertyId']);
    await queryInterface.removeIndex('tasks', ['creatorId']);
    await queryInterface.removeIndex('tasks', ['assignedTo']);
    await queryInterface.removeIndex('tasks', ['status']);
    await queryInterface.removeIndex('tasks', ['priority']);
    await queryInterface.removeIndex('tasks', ['createdAt']);

    await queryInterface.dropTable('tasks');
  }
};
