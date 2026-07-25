'use strict';

// Contrat de partenariat prestataire (docs/DEV_SPEC_TERANGA_v3.md section 3.1,
// clause de non-contournement 13.6.1). FK physique vers providers, même
// justification que providers/mission_status_history (Lot 1) : table neuve,
// vide à la création.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('provider_contracts', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      provider_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'providers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // Part Teranga en % — lue dynamiquement par le module transactions
      // (docs/DEV_SPEC_TERANGA_v3.md section 3.5), jamais codée en dur.
      commission_rate: { type: Sequelize.DECIMAL(5, 2), allowNull: false },

      non_circumvention_months: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 12,
      },

      signed_at: { type: Sequelize.DATE, allowNull: false },
      document_url: { type: Sequelize.STRING(255), allowNull: true },

      status: {
        type: Sequelize.ENUM('active', 'terminated'),
        allowNull: false,
        defaultValue: 'active',
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

    await queryInterface.addIndex('provider_contracts', ['provider_id'], {
      name: 'idx_provider_contracts_provider_id',
    });
    await queryInterface.addIndex('provider_contracts', ['status'], {
      name: 'idx_provider_contracts_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('provider_contracts');
  },
};
