'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.1 — table dédiée, structurée, absente jusqu'ici (DISPUTED
// n'était qu'une valeur d'ENUM sur services.missionStatus, sans motif/preuve/décision associés).
// FK réelles vers services/users, cohérent avec le précédent déjà posé par providers/
// mission_status_history (section 0.6.c du DEV_SPEC v3 : nouvelles tables = FK physiques
// autorisées). snake_case + underscored, cohérent avec les autres tables neuves du même chantier
// (providers, trade_categories, mission_status_history), pas avec le camelCase des tables
// historiques (services, evidences).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mission_disputes', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
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
      opened_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      reason: {
        type: Sequelize.ENUM('non_conforme', 'retard', 'comportement', 'autre'),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      client_evidence: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('open', 'investigating', 'resolved'),
        allowNull: false,
        defaultValue: 'open',
      },
      resolution: {
        type: Sequelize.ENUM('refund', 'redo', 'closed'),
        allowNull: true,
      },
      resolution_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      handled_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      first_contact_at: { type: Sequelize.DATE, allowNull: true },
      // Idempotence de la relance "pas de premier contact" (docs/DEV_SPEC_TERANGA_v4_PHASE0.md
      // §2.2, même logique que services.thresholdAlertSentAt du Lot 2) — sans elle, le job
      // renverrait la même alerte à chaque passage tant que first_contact_at reste NULL.
      first_contact_reminder_sent_at: { type: Sequelize.DATE, allowNull: true },
      decided_at: { type: Sequelize.DATE, allowNull: true },
      // Idempotence de la relance "toujours en cours d'investigation" envoyée au client — même
      // logique que first_contact_reminder_sent_at ci-dessus.
      update_reminder_sent_at: { type: Sequelize.DATE, allowNull: true },
      escalated_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('mission_disputes', ['service_id'], {
      name: 'idx_mission_disputes_service_id',
    });
    await queryInterface.addIndex('mission_disputes', ['status'], {
      name: 'idx_mission_disputes_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mission_disputes');
  },
};
