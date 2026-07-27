'use strict';

// Lieux favoris du client (docs/DEV_SPEC_TERANGA_v3.md section 4.1, étape 2 "Lieu"). N'existait
// nulle part dans le repo : `properties` est un actif immobilier (type/surface obligatoires),
// pas une adresse favorite légère — confirmé par l'inspection du schéma avant ce chantier. Table
// neuve : FK réelle posée dès la création (section 0.5). latitude/longitude NOT NULL car un lieu
// enregistré provient toujours d'une sélection Places Autocomplete ou d'une dépose d'épingle,
// jamais d'un texte libre non résolu.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('saved_locations', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      label: { type: Sequelize.STRING(80), allowNull: true },
      address: { type: Sequelize.STRING(255), allowNull: false },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: false },

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

    await queryInterface.addIndex('saved_locations', ['user_id'], {
      name: 'idx_saved_locations_user_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('saved_locations');
  },
};
