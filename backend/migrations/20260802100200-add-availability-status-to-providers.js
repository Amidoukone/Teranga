'use strict';

// Disponibilité déclarative (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §3) — pas de position GPS
// continue (décision déjà actée en Phase 0), une simple présence déclarée par le prestataire
// lui-même. Alimente la vue "chauffeurs disponibles par zone" du dispatch (Lot 5).
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('providers');

    if (!Object.prototype.hasOwnProperty.call(table, 'availability_status')) {
      await queryInterface.addColumn('providers', 'availability_status', {
        type: Sequelize.ENUM('available', 'busy', 'offline'),
        allowNull: false,
        defaultValue: 'offline',
      });
    }

    const indexes = await queryInterface.showIndex('providers');
    const existingIndexNames = new Set(indexes.map((idx) => idx.name));
    if (!existingIndexNames.has('idx_providers_availability_status')) {
      await queryInterface.addIndex('providers', ['availability_status'], {
        name: 'idx_providers_availability_status',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('providers');

    try {
      await queryInterface.removeIndex('providers', 'idx_providers_availability_status');
    } catch (e) {
      // index déjà absent
    }

    if (Object.prototype.hasOwnProperty.call(table, 'availability_status')) {
      await queryInterface.removeColumn('providers', 'availability_status');
    }
  },
};
