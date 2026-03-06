'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('tasks');

    if (!Object.prototype.hasOwnProperty.call(table, 'currency')) {
      await queryInterface.addColumn('tasks', 'currency', {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE tasks
      SET currency = 'XOF'
      WHERE currency IS NULL OR TRIM(currency) = '';
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('tasks');
    if (Object.prototype.hasOwnProperty.call(table, 'currency')) {
      await queryInterface.removeColumn('tasks', 'currency');
    }
  },
};
