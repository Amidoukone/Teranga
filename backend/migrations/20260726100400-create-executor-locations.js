'use strict';

// Position live des exécutants (docs/DEV_SPEC_TERANGA_v3.md section 3.1/4.2, "Suivi en direct").
// Table neuve : FK réelle posée dès la création (section 0.5). `service_id` nullable : une
// position "au repos" (hors mission active) n'est pas rattachée à une mission — seul le ping
// envoyé pendant une mission active (section 3.3, POST /missions/:id/location) la renseigne.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('executor_locations', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      executor_type: {
        type: Sequelize.ENUM('agent', 'provider'),
        allowNull: false,
      },
      executor_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },

      service_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'services', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: false },

      recorded_at: { type: Sequelize.DATE, allowNull: false },

      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex(
      'executor_locations',
      ['executor_type', 'executor_id', 'recorded_at'],
      { name: 'idx_executor_locations_executor_recorded' }
    );
    await queryInterface.addIndex('executor_locations', ['service_id'], {
      name: 'idx_executor_locations_service_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('executor_locations');
  },
};
