'use strict';

// Phase 4 doit être déployable avec `db:migrate` seul. Les catégories Livraison/Mobilité
// existaient jusque-là uniquement dans des seeders, qui ne sont pas exécutés lors d'un
// déploiement normal, et le seeder tarifaire historique précédait la création de Mobilité.
// Cette migration réconcilie donc le catalogue et ajoute une règle Taxi Mali si elle manque.
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const categories = [
      { name: 'Livraison / Courses', slug: 'livraison' },
      { name: 'Mobilité', slug: 'mobilite' },
    ];

    for (const category of categories) {
      const [rows] = await queryInterface.sequelize.query(
        'SELECT id FROM trade_categories WHERE slug = :slug LIMIT 1',
        { replacements: { slug: category.slug } }
      );
      if (rows.length === 0) {
        await queryInterface.bulkInsert('trade_categories', [
          {
            name: category.name,
            slug: category.slug,
            requires_company: false,
            default_warranty_days: 0,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
        ]);
      }
    }

    const [maliRows] = await queryInterface.sequelize.query(
      "SELECT id FROM countries WHERE iso_code = 'ML' AND is_active = 1 LIMIT 1"
    );
    const [mobiliteRows] = await queryInterface.sequelize.query(
      "SELECT id FROM trade_categories WHERE slug = 'mobilite' LIMIT 1"
    );
    if (maliRows.length === 0 || mobiliteRows.length === 0) return;

    const countryId = maliRows[0].id;
    const tradeCategoryId = mobiliteRows[0].id;
    const [ruleRows] = await queryInterface.sequelize.query(
      `SELECT id FROM mission_pricing_rules
       WHERE country_id = :countryId AND region_id IS NULL
         AND trade_category_id = :tradeCategoryId AND service_type IS NULL
       LIMIT 1`,
      { replacements: { countryId, tradeCategoryId } }
    );
    if (ruleRows.length > 0) return;

    await queryInterface.bulkInsert('mission_pricing_rules', [
      {
        country_id: countryId,
        region_id: null,
        trade_category_id: tradeCategoryId,
        service_type: null,
        pricing_mode: 'fixed_estimate',
        base_price: 1500,
        min_price: null,
        price_per_km: 150,
        estimated_delay_minutes: 45,
        is_active: true,
        updated_by_user_id: null,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  // Migration de réconciliation : ne supprime pas des catégories ou tarifs susceptibles
  // d'avoir reçu de vraies missions après déploiement.
  async down() {},
};
