'use strict';

// Colonnes additives sur services (camelCase, cohérent avec le reste de cette
// table), nullable en DB (voir docs/DEV_SPEC_TERANGA_v3.md section 0.5) :
// l'historique n'a jamais eu de coordonnées, un backfill géocodé partiel ne
// peut pas garantir 100% de couverture sur les adresses en texte libre
// existantes. L'obligation "latitude/longitude requis" pour les NOUVELLES
// missions est portée par la validation Joi applicative (missionRequest /
// service schemas), pas par une contrainte NOT NULL rétroactive.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('services');

    if (!Object.prototype.hasOwnProperty.call(table, 'latitude')) {
      await queryInterface.addColumn('services', 'latitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'longitude')) {
      await queryInterface.addColumn('services', 'longitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('services');
    const existingIndexNames = new Set(indexes.map((idx) => idx.name));

    if (!existingIndexNames.has('idx_services_lat_lng')) {
      await queryInterface.addIndex('services', ['latitude', 'longitude'], {
        name: 'idx_services_lat_lng',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('services');

    try {
      await queryInterface.removeIndex('services', 'idx_services_lat_lng');
    } catch (e) {
      // index déjà absent, rien à faire
    }

    if (Object.prototype.hasOwnProperty.call(table, 'longitude')) {
      await queryInterface.removeColumn('services', 'longitude');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'latitude')) {
      await queryInterface.removeColumn('services', 'latitude');
    }
  },
};
