'use strict';

// Filière "Mobilité" (docs/DEV_SPEC_TERANGA_v5_PHASE2.md §1) — usage interne uniquement pour
// l'instant (Cas 1, logistique). Même motif que la filière Livraison
// (20260725150000-seed-livraison-trade-category.js). Pas de seuils de professionnalisme dans ce
// lot (hors périmètre, réservés à Teranga Taxi/Phase 4).
const CATEGORY = {
  name: 'Mobilité',
  slug: 'mobilite',
  requires_company: false,
  default_warranty_days: 0,
};

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      'SELECT id FROM trade_categories WHERE slug = ? LIMIT 1',
      { replacements: [CATEGORY.slug] }
    );
    if (existing.length > 0) return; // déjà présent, idempotent

    const now = new Date();
    return queryInterface.bulkInsert('trade_categories', [
      { ...CATEGORY, is_active: true, created_at: now, updated_at: now },
    ]);
  },

  async down(queryInterface) {
    return queryInterface.bulkDelete('trade_categories', { slug: CATEGORY.slug }, {});
  },
};
