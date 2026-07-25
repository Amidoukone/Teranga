'use strict';

const {
  MISSION_STATUS_VALUES,
  MISSION_ACTOR_TYPE_VALUES,
} = require('../src/constants/missionStatus');

// Journal d'audit immuable des transitions de statut de mission (voir
// docs/DEV_SPEC_TERANGA_v3.md section 2). Table neuve de ce chantier : FK
// physiques vers services.id et users.id (voir justification dans la
// migration create-providers.js).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mission_status_history', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      service_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'services', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      from_status: {
        type: Sequelize.ENUM(...MISSION_STATUS_VALUES),
        allowNull: true, // NULL pour la toute première transition d'une mission
      },
      to_status: {
        type: Sequelize.ENUM(...MISSION_STATUS_VALUES),
        allowNull: false,
      },

      actor_type: {
        type: Sequelize.ENUM(...MISSION_ACTOR_TYPE_VALUES),
        allowNull: false,
      },
      actor_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true, // NULL quand actor_type='system'
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('mission_status_history', ['service_id'], {
      name: 'idx_mission_status_history_service_id',
    });
    await queryInterface.addIndex(
      'mission_status_history',
      ['service_id', 'created_at'],
      { name: 'idx_mission_status_history_service_id_created_at' }
    );
    await queryInterface.addIndex('mission_status_history', ['to_status'], {
      name: 'idx_mission_status_history_to_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mission_status_history');
  },
};
