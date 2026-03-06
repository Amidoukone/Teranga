'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('services');

    if (!Object.prototype.hasOwnProperty.call(table, 'currency')) {
      await queryInterface.addColumn('services', 'currency', {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE services
      SET currency = 'XOF'
      WHERE currency IS NULL OR TRIM(currency) = '';
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('services');
    if (Object.prototype.hasOwnProperty.call(table, 'currency')) {
      await queryInterface.removeColumn('services', 'currency');
    }
  },
};
