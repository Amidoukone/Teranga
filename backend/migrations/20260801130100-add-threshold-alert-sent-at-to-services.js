'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §1.2 — idempotence du job d'alerte : posée au moment
// d'une alerte, réinitialisée à NULL à chaque transition de statut (missionStatus.service.js)
// pour permettre une nouvelle alerte si la mission se re-bloque à une étape suivante. Colonne
// camelCase, cohérente avec le reste de cette table (executionType/providerId/missionStatus...).
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('services');

    if (!Object.prototype.hasOwnProperty.call(table, 'thresholdAlertSentAt')) {
      await queryInterface.addColumn('services', 'thresholdAlertSentAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('services');

    if (Object.prototype.hasOwnProperty.call(table, 'thresholdAlertSentAt')) {
      await queryInterface.removeColumn('services', 'thresholdAlertSentAt');
    }
  },
};
