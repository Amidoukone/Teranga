'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },

      // 🔗 Relations logiques (sans contraintes FK côté DB)
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      },
      serviceId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      taskId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },

      // ✅ Types cohérents avec le contrôleur et le frontend
      type: {
        type: Sequelize.ENUM('revenue', 'expense', 'commission', 'adjustment'),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'XOF'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      proofFile: {
        type: Sequelize.JSON,
        allowNull: true
      },

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

    // 🔍 Indexes utiles
    await queryInterface.addIndex('transactions', ['userId']);
    await queryInterface.addIndex('transactions', ['type']);
    await queryInterface.addIndex('transactions', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transactions');
  }
};
