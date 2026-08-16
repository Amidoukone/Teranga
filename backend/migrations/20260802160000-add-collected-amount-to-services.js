'use strict';

// Réconciliation cash à la remise, filière livraison (docs/DEV_SPEC_TERANGA_v6_PHASE3.md §5) —
// montant optionnel déclaré par l'exécutant à la transition COMPLETED, NULL pour toutes les
// autres filières et pour toute mission livraison où le champ n'est pas renseigné. Colonne
// additive camelCase, cohérente avec le reste de cette table historique.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('services');

    if (!Object.prototype.hasOwnProperty.call(table, 'collectedAmount')) {
      await queryInterface.addColumn('services', 'collectedAmount', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('services');

    if (Object.prototype.hasOwnProperty.call(table, 'collectedAmount')) {
      await queryInterface.removeColumn('services', 'collectedAmount');
    }
  },
};
