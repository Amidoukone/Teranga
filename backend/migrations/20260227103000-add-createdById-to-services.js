'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('services', 'createdById', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
    });

    await queryInterface.addIndex('services', ['createdById'], {
      name: 'idx_services_createdById',
    });

    // Backfill historique: en absence de piste fiable, on aligne sur clientId.
    await queryInterface.sequelize.query(`
      UPDATE services
      SET createdById = clientId
      WHERE createdById IS NULL
        AND clientId IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('services', 'idx_services_createdById');
    await queryInterface.removeColumn('services', 'createdById');
  },
};
