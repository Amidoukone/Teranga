'use strict';

const CATEGORIES = [
  { name: 'Plomberie', slug: 'plomberie', requires_company: false, default_warranty_days: 30 },
  { name: 'Électricité', slug: 'electricite', requires_company: false, default_warranty_days: 30 },
  { name: 'Sécurité / gardiennage', slug: 'securite-gardiennage', requires_company: true, default_warranty_days: 0 },
  { name: 'Ménage', slug: 'menage', requires_company: false, default_warranty_days: 0 },
  { name: 'Peinture', slug: 'peinture', requires_company: false, default_warranty_days: 15 },
  { name: 'Climatisation', slug: 'climatisation', requires_company: false, default_warranty_days: 30 },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    return queryInterface.bulkInsert(
      'trade_categories',
      CATEGORIES.map((c) => ({
        ...c,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      {}
    );
  },

  async down(queryInterface) {
    return queryInterface.bulkDelete(
      'trade_categories',
      { slug: CATEGORIES.map((c) => c.slug) },
      {}
    );
  },
};
