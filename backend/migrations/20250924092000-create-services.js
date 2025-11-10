'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('services', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      clientId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      agentId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      propertyId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'properties', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },

      // Champs métier
      type: {
        type: Sequelize.ENUM('errand', 'administrative', 'payment', 'money_transfer', 'other'),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT
      },
      contactPerson: {
        type: Sequelize.STRING
      },
      contactPhone: {
        type: Sequelize.STRING
      },
      address: {
        type: Sequelize.TEXT
      },
      budget: {
        type: Sequelize.DECIMAL(12, 2)
      },

      // Workflow
      status: {
        type: Sequelize.ENUM('created', 'in_progress', 'completed', 'validated'),
        allowNull: false,
        defaultValue: 'created'
      },

      // Tracking
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
    }, {
      engine: 'InnoDB'
    });

    // Indexes utiles
    await queryInterface.addIndex('services', ['clientId']);
    await queryInterface.addIndex('services', ['agentId']);
    await queryInterface.addIndex('services', ['propertyId']);
    await queryInterface.addIndex('services', ['status']);
    await queryInterface.addIndex('services', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('services');
  }
};
