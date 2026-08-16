'use strict';

// Checklist onboarding chauffeur (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §2) — conformité arrêté
// municipal Bamako n°067/M-DB (plaque + carte de circulation). L'assurance existe déjà
// (has_liability_insurance/insurance_expires_at, Lot 1). Colonnes additives, cohérentes avec la
// convention snake_case déjà en place sur cette table.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('providers');

    if (!Object.prototype.hasOwnProperty.call(table, 'plate_number')) {
      await queryInterface.addColumn('providers', 'plate_number', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'circulation_card_number')) {
      await queryInterface.addColumn('providers', 'circulation_card_number', {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'circulation_card_verified')) {
      await queryInterface.addColumn('providers', 'circulation_card_verified', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('providers');

    if (Object.prototype.hasOwnProperty.call(table, 'circulation_card_verified')) {
      await queryInterface.removeColumn('providers', 'circulation_card_verified');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'circulation_card_number')) {
      await queryInterface.removeColumn('providers', 'circulation_card_number');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'plate_number')) {
      await queryInterface.removeColumn('providers', 'plate_number');
    }
  },
};
