'use strict';
const { Model } = require('sequelize');

function toNullableNumber(v) {
  return (v === '' || v === undefined || v === null) ? null : v;
}

module.exports = (sequelize, DataTypes) => {
  class Property extends Model {
    static associate(models) {
      Property.belongsTo(models.User, {
        foreignKey: 'ownerId',
        as: 'owner',
      });

      /**
       * 🌍 Multi-pays (associations logiques uniquement)
       * - Pas de FK DB pour garder les imports MySQL portables
       * - Permet include: [{ model: Country, as: 'country' }]
       */
      if (models.Country) {
        Property.belongsTo(models.Country, {
          foreignKey: 'countryId',
          as: 'country',
        });
      }

      if (models.Region) {
        Property.belongsTo(models.Region, {
          foreignKey: 'regionId',
          as: 'region',
        });
      }
    }
  }

  Property.init(
    {
      ownerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },

      type: {
        type: DataTypes.ENUM('house', 'apartment', 'land', 'automobile', 'commercial'),
        allowNull: false,
      },

      address: { type: DataTypes.TEXT, allowNull: false },
      city: { type: DataTypes.STRING, allowNull: false },
      postalCode: { type: DataTypes.STRING, allowNull: true },

      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        set(v) {
          this.setDataValue('latitude', toNullableNumber(v));
        },
      },

      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        set(v) {
          this.setDataValue('longitude', toNullableNumber(v));
        },
      },

      surfaceArea: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        set(v) {
          this.setDataValue('surfaceArea', toNullableNumber(v));
        },
      },

      roomCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        set(v) {
          this.setDataValue('roomCount', toNullableNumber(v));
        },
      },

      status: {
        type: DataTypes.ENUM('active', 'inactive', 'sold'),
        defaultValue: 'active',
      },

      /**
       * ============================================================
       * 🌍 Multi-pays / franchise (NOUVEAU – non bloquant)
       * ============================================================
       * - Ajouté par migration : properties.countryId / properties.regionId
       * - Nullable pour éviter toute régression
       * - Renseigné par :
       *    • backfill (Mali/Bamako)
       *    • resolveGeoScope / héritage (user/franchise) côté backend
       */
      countryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      regionId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },

      /**
       * 🖼 MULTI-PHOTOS (ImageKit ou legacy local)
       * - JSON ARRAY d’URL
       * - ex: ["https://ik.imagekit.io/.../photo1.jpg", ...]
       */
      photos: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'Property',
      tableName: 'properties',

      /**
       * ✅ Timestamps
       * - Aligné avec ta prod : createdAt/updatedAt camelCase
       * - On laisse la config globale (define.timestamps=true) faire le job
       */
      timestamps: true,
    }
  );

  return Property;
};
