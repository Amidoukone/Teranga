'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transactions', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },

      serviceId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      taskId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      projectId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      // ⚠ colonne réelle = order_id
      order_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      type: {
        type: Sequelize.ENUM('revenue', 'expense', 'commission', 'adjustment'),
        allowNull: false,
      },

      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      },

      paymentMethod: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM('pending', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      proofFile: {
        type: Sequelize.JSON,
        allowNull: true,
      },

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

    await queryInterface.addIndex('transactions', ['userId']);
    await queryInterface.addIndex('transactions', ['serviceId']);
    await queryInterface.addIndex('transactions', ['taskId']);
    await queryInterface.addIndex('transactions', ['projectId']);
    await queryInterface.addIndex('transactions', ['order_id']);
    await queryInterface.addIndex('transactions', ['type']);
    await queryInterface.addIndex('transactions', ['status']);
    await queryInterface.addIndex('transactions', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transactions');

    // Nettoyer enums si PostgreSQL
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        DROP TYPE IF EXISTS "enum_transactions_type";
        DROP TYPE IF EXISTS "enum_transactions_status";
      `);
    }
  },
};
