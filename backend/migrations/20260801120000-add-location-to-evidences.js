'use strict';

// docs/DEV_SPEC_TERANGA_v4_PHASE0.md §4.1 — position capturée au moment de l'upload d'une
// preuve (best-effort côté client, jamais bloquant), comparée à la position connue de la
// mission/du bien pour qualifier `locationFlag`. Colonnes additives camelCase, cohérentes avec
// la convention déjà suivie sur cette table (cf. migration serviceId du 2026-07-26). Toutes
// nullables : l'absence de position n'est jamais une erreur sur ce terrain (permission
// navigateur refusée, GPS indisponible, connectivité coupée).
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('evidences');

    if (!Object.prototype.hasOwnProperty.call(table, 'latitude')) {
      await queryInterface.addColumn('evidences', 'latitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'longitude')) {
      await queryInterface.addColumn('evidences', 'longitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'locationFlag')) {
      await queryInterface.addColumn('evidences', 'locationFlag', {
        type: Sequelize.ENUM('ok', 'distant', 'unknown'),
        allowNull: true,
        defaultValue: 'unknown',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('evidences');

    if (Object.prototype.hasOwnProperty.call(table, 'locationFlag')) {
      await queryInterface.removeColumn('evidences', 'locationFlag');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'longitude')) {
      await queryInterface.removeColumn('evidences', 'longitude');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'latitude')) {
      await queryInterface.removeColumn('evidences', 'latitude');
    }
  },
};
