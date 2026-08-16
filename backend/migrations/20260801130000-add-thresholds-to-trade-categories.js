'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §1.1 — seuils de professionnalisme différenciés par
// filière. Colonnes additives snake_case, cohérentes avec la convention `underscored: true`
// déjà utilisée sur cette table (requires_company, default_warranty_days...). Nullables : une
// filière sans seuil défini n'est simplement jamais vérifiée par le job (voir job §1.2), plutôt
// que de forcer une valeur arbitraire.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('trade_categories');

    if (!Object.prototype.hasOwnProperty.call(table, 'intake_threshold_minutes')) {
      await queryInterface.addColumn('trade_categories', 'intake_threshold_minutes', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'alert_threshold_minutes')) {
      await queryInterface.addColumn('trade_categories', 'alert_threshold_minutes', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('trade_categories');

    if (Object.prototype.hasOwnProperty.call(table, 'alert_threshold_minutes')) {
      await queryInterface.removeColumn('trade_categories', 'alert_threshold_minutes');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'intake_threshold_minutes')) {
      await queryInterface.removeColumn('trade_categories', 'intake_threshold_minutes');
    }
  },
};
