'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.2 — quatre nouvelles valeurs pour que le parcours de
// litige soit distinguable dans les notifications (ouverture, relance/mise à jour, escalade,
// résolution). Élargit l'ENUM déjà étendu une première fois pour 'threshold_alert' (voir
// 20260801130300-add-threshold-alert-to-notifications-action-enum.js).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('notifications', 'action', {
      type: Sequelize.ENUM(
        'created',
        'assigned',
        'status_updated',
        'threshold_alert',
        'dispute_opened',
        'dispute_update',
        'dispute_escalated',
        'dispute_resolved'
      ),
      allowNull: false,
      defaultValue: 'created',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('notifications', 'action', {
      type: Sequelize.ENUM('created', 'assigned', 'status_updated', 'threshold_alert'),
      allowNull: false,
      defaultValue: 'created',
    });
  },
};
