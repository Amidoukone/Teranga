'use strict';

// Filière "Livraison" (docs/DEV_SPEC_TERANGA_v3.md, homepage Lot 2 : demandes de
// livraison routées via le modèle Teranga Pro/filière plutôt que d'étendre
// l'ENUM legacy services.type — voir décision dans le doc).
const CATEGORY = {
  name: 'Livraison / Courses',
  slug: 'livraison',
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
