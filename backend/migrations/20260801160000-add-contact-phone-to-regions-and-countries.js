'use strict';

// docs/BRAINSTORM_ECOSYSTEME_TERANGA.md §7 — "un numéro Teranga par région/master local" pour
// la marketplace immobilière (décision utilisateur, pas un numéro central unique). Colonne
// snake_case avec field: explicite, cohérente avec is_active/iso_code déjà sur ces deux tables.
// Fallback en cascade géré côté application (region -> country), pas en base.
module.exports = {
  async up(queryInterface, Sequelize) {
    const regionsTable = await queryInterface.describeTable('regions');
    if (!Object.prototype.hasOwnProperty.call(regionsTable, 'contact_phone')) {
      await queryInterface.addColumn('regions', 'contact_phone', {
        type: Sequelize.STRING(30),
        allowNull: true,
      });
    }

    const countriesTable = await queryInterface.describeTable('countries');
    if (!Object.prototype.hasOwnProperty.call(countriesTable, 'contact_phone')) {
      await queryInterface.addColumn('countries', 'contact_phone', {
        type: Sequelize.STRING(30),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const regionsTable = await queryInterface.describeTable('regions');
    if (Object.prototype.hasOwnProperty.call(regionsTable, 'contact_phone')) {
      await queryInterface.removeColumn('regions', 'contact_phone');
    }

    const countriesTable = await queryInterface.describeTable('countries');
    if (Object.prototype.hasOwnProperty.call(countriesTable, 'contact_phone')) {
      await queryInterface.removeColumn('countries', 'contact_phone');
    }
  },
};
