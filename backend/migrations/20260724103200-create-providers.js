'use strict';

// Table neuve de ce chantier (Teranga Pro) : contrairement à la convention
// historique du repo (aucune FK physique, héritage PlanetScale), on pose de
// vraies contraintes FK ici. C'est explicitement le périmètre autorisé par
// docs/DEV_SPEC_TERANGA_v3.md section 0.6.c : la validation se fait sur cette
// table neuve (vide à la création), pas sur une table historique volumineuse,
// et la base est maintenant DigitalOcean Managed MySQL (InnoDB standard),
// qui supporte les FK contrairement à PlanetScale.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('providers', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // Identité de connexion : réutilise l'auth JWT existante (users.role='provider'),
      // pas de second système d'authentification.
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      type: {
        type: Sequelize.ENUM('independent', 'company'),
        allowNull: false,
      },

      legal_name: { type: Sequelize.STRING(150), allowNull: true },
      display_first_name: { type: Sequelize.STRING(80), allowNull: false },
      rccm_number: { type: Sequelize.STRING(50), allowNull: true },

      // Contact professionnel interne (admin) — jamais exposé au client,
      // distinct des identifiants de connexion portés par users.
      phone_number: { type: Sequelize.STRING(30), allowNull: false },
      email: { type: Sequelize.STRING(150), allowNull: true },

      // ISO 3166-1 alpha-2, aligné sur countries.iso_code (VARCHAR(2)).
      country_code: {
        type: Sequelize.STRING(2),
        allowNull: false,
        references: { model: 'countries', key: 'iso_code' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },

      status: {
        type: Sequelize.ENUM('pending', 'probation', 'active', 'suspended', 'revoked'),
        allowNull: false,
        defaultValue: 'pending',
      },

      average_rating: { type: Sequelize.DECIMAL(3, 2), allowNull: true },
      completed_missions_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      has_liability_insurance: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      insurance_expires_at: { type: Sequelize.DATEONLY, allowNull: true },

      badge_certified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addIndex('providers', ['country_code'], {
      name: 'idx_providers_country_code',
    });
    await queryInterface.addIndex('providers', ['status'], {
      name: 'idx_providers_status',
    });
    await queryInterface.addIndex('providers', ['type'], {
      name: 'idx_providers_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('providers');
  },
};
