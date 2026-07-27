'use strict';

// Valeurs de départ pour la tarification configurable (docs/DEV_SPEC_TERANGA_v3.md section 4.1,
// étape 4). Ce ne sont PAS des tarifs figés ni une étude tarifaire : ce sont des ordres de
// grandeur du marché informel à Bamako (marché domestique de Teranga), à ajuster pays par pays
// via l'interface admin (`/admin/mission-pricing`) au fur et à mesure de l'expansion. Seul le
// pays Mali reçoit des règles calibrées par filière/type ; les autres pays actifs au moment du
// seed reçoivent uniquement une règle générique "sur devis" en repli neutre, en attendant qu'un
// master local calibre son propre marché.
//
// Rationale résumée par catégorie (Mali, XOF) :
// - Plomberie / Électricité : intervention de dépannage simple, ~7500 XOF, ~90 min.
// - Climatisation : plus technique/équipé, ~12000 XOF, ~120 min.
// - Ménage : prestation à la visite, ~6000 XOF, ~120 min.
// - Peinture : dépend fortement de la surface, affiché "à partir de" 15000 XOF, ~240 min.
// - Sécurité/gardiennage : engagement d'entreprise (requires_company), pas une intervention
//   ponctuelle → sur devis, délai indicatif 24h (prise de contact).
// - Livraison/Courses : besoin fréquent et bon marché, ~2000 XOF + 150 XOF/km, ~60 min.
// - Course/Commission (classique) : ~1500 XOF, ~60 min.
// - Démarche administrative : file d'attente/déplacement en préfecture, ~5000 XOF, ~240 min.
// - Paiement : tâche rapide, ~1000 XOF, ~30 min.
// - Transfert d'argent (logistique de l'errand, pas les fonds eux-mêmes — 0.4) : ~1500 XOF, ~30 min.
// - Autre service : besoin non qualifiable à l'avance → sur devis, ~120 min.

const MALI_TRADE_CATEGORY_RULES = [
  { slug: 'plomberie', pricingMode: 'fixed_estimate', basePrice: 7500, estimatedDelayMinutes: 90 },
  { slug: 'electricite', pricingMode: 'fixed_estimate', basePrice: 7500, estimatedDelayMinutes: 90 },
  { slug: 'climatisation', pricingMode: 'fixed_estimate', basePrice: 12000, estimatedDelayMinutes: 120 },
  { slug: 'menage', pricingMode: 'fixed_estimate', basePrice: 6000, estimatedDelayMinutes: 120 },
  {
    slug: 'peinture',
    pricingMode: 'fixed_estimate',
    basePrice: 15000,
    minPrice: 15000,
    estimatedDelayMinutes: 240,
  },
  {
    slug: 'securite-gardiennage',
    pricingMode: 'quote_only',
    estimatedDelayMinutes: 1440,
  },
  {
    slug: 'livraison',
    pricingMode: 'fixed_estimate',
    basePrice: 2000,
    pricePerKm: 150,
    estimatedDelayMinutes: 60,
  },
];

const MALI_SERVICE_TYPE_RULES = [
  { serviceType: 'errand', pricingMode: 'fixed_estimate', basePrice: 1500, estimatedDelayMinutes: 60 },
  {
    serviceType: 'administrative',
    pricingMode: 'fixed_estimate',
    basePrice: 5000,
    estimatedDelayMinutes: 240,
  },
  { serviceType: 'payment', pricingMode: 'fixed_estimate', basePrice: 1000, estimatedDelayMinutes: 30 },
  {
    serviceType: 'money_transfer',
    pricingMode: 'fixed_estimate',
    basePrice: 1500,
    estimatedDelayMinutes: 30,
  },
  { serviceType: 'other', pricingMode: 'quote_only', estimatedDelayMinutes: 120 },
];

async function ruleExists(queryInterface, { countryId, tradeCategoryId, serviceType }) {
  const where = tradeCategoryId
    ? 'trade_category_id = :tradeCategoryId AND service_type IS NULL'
    : serviceType
    ? 'service_type = :serviceType AND trade_category_id IS NULL'
    : 'trade_category_id IS NULL AND service_type IS NULL';

  const [rows] = await queryInterface.sequelize.query(
    `SELECT id FROM mission_pricing_rules
     WHERE country_id = :countryId AND region_id IS NULL AND ${where} LIMIT 1`,
    { replacements: { countryId, tradeCategoryId: tradeCategoryId || null, serviceType: serviceType || null } }
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [countries] = await queryInterface.sequelize.query(
      'SELECT id, iso_code FROM countries WHERE is_active = 1'
    );
    if (countries.length === 0) return;

    const rowsToInsert = [];

    const maliCountry = countries.find((c) => c.iso_code === 'ML');
    if (maliCountry) {
      const [tradeCategories] = await queryInterface.sequelize.query(
        'SELECT id, slug FROM trade_categories'
      );
      const tradeCategoryIdBySlug = new Map(tradeCategories.map((tc) => [tc.slug, tc.id]));

      for (const rule of MALI_TRADE_CATEGORY_RULES) {
        const tradeCategoryId = tradeCategoryIdBySlug.get(rule.slug);
        if (!tradeCategoryId) continue; // filière pas encore seedée dans cet environnement
        if (await ruleExists(queryInterface, { countryId: maliCountry.id, tradeCategoryId })) continue;

        rowsToInsert.push({
          country_id: maliCountry.id,
          region_id: null,
          trade_category_id: tradeCategoryId,
          service_type: null,
          pricing_mode: rule.pricingMode,
          base_price: rule.basePrice ?? null,
          min_price: rule.minPrice ?? null,
          price_per_km: rule.pricePerKm ?? 0,
          estimated_delay_minutes: rule.estimatedDelayMinutes,
          is_active: true,
          updated_by_user_id: null,
          created_at: now,
          updated_at: now,
        });
      }

      for (const rule of MALI_SERVICE_TYPE_RULES) {
        if (await ruleExists(queryInterface, { countryId: maliCountry.id, serviceType: rule.serviceType })) {
          continue;
        }

        rowsToInsert.push({
          country_id: maliCountry.id,
          region_id: null,
          trade_category_id: null,
          service_type: rule.serviceType,
          pricing_mode: rule.pricingMode,
          base_price: rule.basePrice ?? null,
          min_price: rule.minPrice ?? null,
          price_per_km: 0,
          estimated_delay_minutes: rule.estimatedDelayMinutes,
          is_active: true,
          updated_by_user_id: null,
          created_at: now,
          updated_at: now,
        });
      }
    }

    // Repli générique "sur devis" pour tout pays actif sans règle spécifique — y compris Mali,
    // au cas où une catégorie non listée ci-dessus serait demandée.
    for (const country of countries) {
      if (await ruleExists(queryInterface, { countryId: country.id })) continue;

      rowsToInsert.push({
        country_id: country.id,
        region_id: null,
        trade_category_id: null,
        service_type: null,
        pricing_mode: 'quote_only',
        base_price: null,
        min_price: null,
        price_per_km: 0,
        estimated_delay_minutes: 120,
        is_active: true,
        updated_by_user_id: null,
        created_at: now,
        updated_at: now,
      });
    }

    if (rowsToInsert.length > 0) {
      await queryInterface.bulkInsert('mission_pricing_rules', rowsToInsert);
    }
  },

  async down(queryInterface) {
    // Seed de point de départ, pas de données utilisateur — suppression large acceptable en down.
    await queryInterface.bulkDelete('mission_pricing_rules', null, {});
  },
};
