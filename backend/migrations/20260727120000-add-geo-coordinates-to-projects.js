'use strict';

// Colonnes additives sur projects (camelCase, cohérent avec le reste de cette
// table), nullable en DB — même principe que services.latitude/longitude
// (20260725160000-add-geo-coordinates-to-services.js) : géolocalisation
// optionnelle, jamais bloquante pour la création/modification d'un projet.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('projects');

    if (!Object.prototype.hasOwnProperty.call(table, 'address')) {
      await queryInterface.addColumn('projects', 'address', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'city')) {
      await queryInterface.addColumn('projects', 'city', {
        type: Sequelize.STRING(150),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'latitude')) {
      await queryInterface.addColumn('projects', 'latitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(table, 'longitude')) {
      await queryInterface.addColumn('projects', 'longitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('projects');
    const existingIndexNames = new Set(indexes.map((idx) => idx.name));

    if (!existingIndexNames.has('idx_projects_lat_lng')) {
      await queryInterface.addIndex('projects', ['latitude', 'longitude'], {
        name: 'idx_projects_lat_lng',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('projects');

    try {
      await queryInterface.removeIndex('projects', 'idx_projects_lat_lng');
    } catch (e) {
      // index déjà absent, rien à faire
    }

    if (Object.prototype.hasOwnProperty.call(table, 'longitude')) {
      await queryInterface.removeColumn('projects', 'longitude');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'latitude')) {
      await queryInterface.removeColumn('projects', 'latitude');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'city')) {
      await queryInterface.removeColumn('projects', 'city');
    }
    if (Object.prototype.hasOwnProperty.call(table, 'address')) {
      await queryInterface.removeColumn('projects', 'address');
    }
  },
};
