'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §2.3 — incrémenté uniquement quand un litige se résout en
// 'refund'/'redo' (un litige clôturé 'closed' comme non fondé ne compte pas contre le
// prestataire). Colonne snake_case, cohérente avec average_rating/completed_missions_count déjà
// sur cette table (underscored: true).
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('providers');

    if (!Object.prototype.hasOwnProperty.call(table, 'disputes_against_count')) {
      await queryInterface.addColumn('providers', 'disputes_against_count', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('providers');

    if (Object.prototype.hasOwnProperty.call(table, 'disputes_against_count')) {
      await queryInterface.removeColumn('providers', 'disputes_against_count');
    }
  },
};
