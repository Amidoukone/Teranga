'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('transactions');
    const indexes = await queryInterface.showIndex('transactions');

    if (!Object.prototype.hasOwnProperty.call(table, 'paymentMethod')) {
      await queryInterface.addColumn('transactions', 'paymentMethod', {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'status')) {
      await queryInterface.addColumn('transactions', 'status', {
        type: Sequelize.ENUM('pending', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      });
    }

    const hasStatusIndex = indexes.some((idx) =>
      (idx.fields || []).some((field) => field.attribute === 'status')
    );
    const hasPaymentMethodIndex = indexes.some((idx) =>
      (idx.fields || []).some((field) => field.attribute === 'paymentMethod')
    );

    if (!hasStatusIndex) {
      await queryInterface.addIndex('transactions', ['status']);
    }
    if (!hasPaymentMethodIndex) {
      await queryInterface.addIndex('transactions', ['paymentMethod']);
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('transactions');

    if (Object.prototype.hasOwnProperty.call(table, 'paymentMethod')) {
      await queryInterface.removeColumn('transactions', 'paymentMethod');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'status')) {
      await queryInterface.removeColumn('transactions', 'status');
    }
  },
};
