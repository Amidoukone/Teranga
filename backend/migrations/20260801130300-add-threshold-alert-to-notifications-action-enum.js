'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §1.2 — le job de seuils (missionThresholdCheck.job.js)
// notifie via emitEvent()/action:'threshold_alert', mais notifications.action était un ENUM
// fermé ('created','assigned','status_updated') qui rejette toute valeur inconnue (constaté en
// test manuel : WARN_DATA_TRUNCATED). Élargit l'ENUM plutôt que de réutiliser une valeur
// existante à contresens — un master doit pouvoir distinguer une vraie mise à jour de statut
// d'une alerte de seuil en lisant `action` seule.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('notifications', 'action', {
      type: Sequelize.ENUM('created', 'assigned', 'status_updated', 'threshold_alert'),
      allowNull: false,
      defaultValue: 'created',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('notifications', 'action', {
      type: Sequelize.ENUM('created', 'assigned', 'status_updated'),
      allowNull: false,
      defaultValue: 'created',
    });
  },
};
