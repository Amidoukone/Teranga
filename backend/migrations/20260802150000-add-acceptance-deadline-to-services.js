'use strict';

// Fenêtre d'acceptation du dispatch mobilité (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §5.2) — posée
// uniquement pour les missions filière Mobilité au moment de l'affectation (exports.assign),
// NULL pour toutes les autres filières (comportement inchangé ailleurs). Colonne additive
// camelCase, cohérente avec le reste de cette table historique.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('services');

    if (!Object.prototype.hasOwnProperty.call(table, 'acceptanceDeadlineAt')) {
      await queryInterface.addColumn('services', 'acceptanceDeadlineAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('services');

    if (Object.prototype.hasOwnProperty.call(table, 'acceptanceDeadlineAt')) {
      await queryInterface.removeColumn('services', 'acceptanceDeadlineAt');
    }
  },
};
