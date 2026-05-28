'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('properties', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },

      ownerId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
        // Pas de contrainte FK en base.
      },

      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },

      description: {
        type: Sequelize.TEXT
      },

      type: {
        type: Sequelize.ENUM('house', 'apartment', 'land', 'commercial'),
        allowNull: false
      },

      address: {
        type: Sequelize.TEXT,
        allowNull: false
      },

      city: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      postalCode: {
        type: Sequelize.STRING(20),
        allowNull: true
      },

      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      surfaceArea: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      roomCount: { type: Sequelize.INTEGER, allowNull: true },

      status: {
        type: Sequelize.ENUM('active', 'inactive', 'sold'),
        defaultValue: 'active'
      },

      /**
       * 🖼 Multi-photos (JSON Array)
       * - nécessaire pour ImageKit
       * - ex: ["https://ik.imagekit.io/..."]
       */
      photos: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('properties', ['ownerId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('properties');

    // Supprimer ENUMs si Postgres
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        DROP TYPE IF EXISTS "enum_properties_type";
        DROP TYPE IF EXISTS "enum_properties_status";
      `);
    }
  }
};
