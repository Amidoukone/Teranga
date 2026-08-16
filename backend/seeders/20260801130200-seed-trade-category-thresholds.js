'use strict';

// Valeurs de départ, docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §8.1 / docs/DEV_SPEC_TERANGA_v4_PHASE0.md
// §1.1 — hypothèse à calibrer avec des données réelles une fois l'usage lancé, pas une norme figée.
// 'securite-gardiennage' n'est volontairement pas seedée ici (filière retirée, voir DEV_SPEC §5).
const THRESHOLDS = [
  { slug: 'electricite', intake_threshold_minutes: 60, alert_threshold_minutes: 120 },
  { slug: 'plomberie', intake_threshold_minutes: 90, alert_threshold_minutes: 180 },
  { slug: 'climatisation', intake_threshold_minutes: 180, alert_threshold_minutes: 180 },
  { slug: 'menage', intake_threshold_minutes: 1440, alert_threshold_minutes: 2880 },
  { slug: 'peinture', intake_threshold_minutes: 2880, alert_threshold_minutes: 4320 },
  { slug: 'livraison', intake_threshold_minutes: 25, alert_threshold_minutes: 45 },
];

module.exports = {
  async up(queryInterface) {
    for (const t of THRESHOLDS) {
      await queryInterface.sequelize.query(
        'UPDATE trade_categories SET intake_threshold_minutes = ?, alert_threshold_minutes = ? WHERE slug = ?',
        { replacements: [t.intake_threshold_minutes, t.alert_threshold_minutes, t.slug] }
      );
    }
  },

  async down(queryInterface) {
    const slugs = THRESHOLDS.map((t) => t.slug);
    await queryInterface.sequelize.query(
      `UPDATE trade_categories SET intake_threshold_minutes = NULL, alert_threshold_minutes = NULL WHERE slug IN (${slugs
        .map(() => '?')
        .join(',')})`,
      { replacements: slugs }
    );
  },
};
