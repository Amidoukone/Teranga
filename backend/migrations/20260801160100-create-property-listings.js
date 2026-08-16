'use strict';

// docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7 — marketplace immobilière : fiches simples, gérées
// uniquement par l'admin/category manager, aucun compte agence/propriétaire (contrairement à
// `properties`, qui reste "un client gère son propre bien" et n'est pas touché par ce chantier).
// snake_case + FK réelle sur created_by (nouvelle table, cf. décision 0.6.c du DEV_SPEC v3).
// country_id/region_id restent des associations logiques (pas de FK), même convention que
// trade_categories/services pour les colonnes de scope géographique.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('property_listings', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      title: { type: Sequelize.STRING(150), allowNull: false },
      type: {
        type: Sequelize.ENUM('house', 'apartment', 'land'),
        allowNull: false,
      },
      transaction_type: {
        type: Sequelize.ENUM('rent', 'sale'),
        allowNull: false,
      },
      neighborhood: { type: Sequelize.STRING(120), allowNull: true },
      city: { type: Sequelize.STRING(120), allowNull: false },
      country_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      region_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      price: { type: Sequelize.DECIMAL(14, 2), allowNull: false },
      currency: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'XOF' },
      description: { type: Sequelize.TEXT, allowNull: true },
      photos: { type: Sequelize.JSON, allowNull: true },
      status: {
        type: Sequelize.ENUM('available', 'rented', 'sold'),
        allowNull: false,
        defaultValue: 'available',
      },
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('property_listings', ['status'], {
      name: 'idx_property_listings_status',
    });
    await queryInterface.addIndex('property_listings', ['country_id', 'region_id'], {
      name: 'idx_property_listings_geo',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('property_listings');
  },
};
