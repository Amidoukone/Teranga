'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('trade_categories', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // 🏷️ Identité de la filière (ex: "Plomberie", "Électricité")
      name: { type: Sequelize.STRING(100), allowNull: false },
      slug: { type: Sequelize.STRING(120), allowNull: false, unique: true },

      // Certaines filières (ex: sécurité/gardiennage) exigent un prestataire
      // de type 'company', pas un indépendant — voir providers.type.
      requires_company: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // Garantie post-intervention par défaut (jours), reportée sur
      // services.warrantyExpiresAt à la clôture d'une mission.
      default_warranty_days: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('trade_categories', ['slug'], {
      unique: true,
      name: 'uniq_trade_categories_slug',
    });
    await queryInterface.addIndex('trade_categories', ['is_active'], {
      name: 'idx_trade_categories_is_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('trade_categories');
  },
};
