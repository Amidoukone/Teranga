'use strict';

// Tarification configurable multi-pays/région/filière (docs/DEV_SPEC_TERANGA_v3.md section 4.1,
// étape 4 "confirmation" — prix indicatif + délai estimé calculé côté backend). Table neuve de ce
// chantier : FK réelles posées dès la création (même raisonnement que providers/trade_categories
// au Lot 1, section 0.5). Pas de colonne devise dupliquée : elle est dérivée de countries.currency
// à la lecture (backend/src/services/priceEstimate.service.js), pour ne jamais diverger.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mission_pricing_rules', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // countries.id/regions.id sont en BIGINT UNSIGNED dans ce repo (contrairement à
      // trade_categories.id/users.id en INT UNSIGNED) — types alignés pour la FK.
      country_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'countries', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // NULL = règle par défaut pour tout le pays ; renseigné = surcharge pour cette région.
      region_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'regions', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // Exactement une des deux colonnes catégorie doit être renseignée (contrôlé côté
      // applicatif/Joi, pas de CHECK constraint MySQL portable ici) ; les deux NULL = règle
      // générique de repli pour le pays/la région.
      trade_category_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'trade_categories', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      service_type: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },

      pricing_mode: {
        type: Sequelize.ENUM('fixed_estimate', 'quote_only'),
        allowNull: false,
        defaultValue: 'fixed_estimate',
      },

      base_price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      // Optionnel : permet un affichage "à partir de X" quand le prix réel dépend du diagnostic
      // sur place (ex. peinture selon la surface).
      min_price: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      // Surcharge kilométrique optionnelle (pertinent pour livraison/course), ignorée ailleurs.
      price_per_km: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

      estimated_delay_minutes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },

      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      // Audit : dernier admin/master à avoir touché cette règle.
      updated_by_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex(
      'mission_pricing_rules',
      ['country_id', 'region_id', 'trade_category_id', 'service_type'],
      { name: 'uniq_mission_pricing_scope', unique: true }
    );
    await queryInterface.addIndex('mission_pricing_rules', ['is_active'], {
      name: 'idx_mission_pricing_rules_is_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mission_pricing_rules');
  },
};
