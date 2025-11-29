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
        as: 'owner'
      });
    }
  }

  Property.init(
    {
      ownerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },

      title: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,

      type: {
        type: DataTypes.ENUM('house', 'apartment', 'land', 'commercial'),
        allowNull: false
      },

      address: { type: DataTypes.TEXT, allowNull: false },
      city: { type: DataTypes.STRING, allowNull: false },
      postalCode: { type: DataTypes.STRING, allowNull: true },

      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        set(v) { this.setDataValue('latitude', toNullableNumber(v)); }
      },
      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        set(v) { this.setDataValue('longitude', toNullableNumber(v)); }
      },

      surfaceArea: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        set(v) { this.setDataValue('surfaceArea', toNullableNumber(v)); }
      },
      roomCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
        set(v) { this.setDataValue('roomCount', toNullableNumber(v)); }
      },

      status: {
        type: DataTypes.ENUM('active', 'inactive', 'sold'),
        defaultValue: 'active'
      },

      /**
       * 🖼 MULTI-PHOTOS (ImageKit ou legacy local)
       * - JSON ARRAY d’URL
       * - ex: ["https://ik.imagekit.io/.../photo1.jpg", ...]
       */
      photos: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      }
    },
    {
      sequelize,
      modelName: 'Property',
      tableName: 'properties'
    }
  );

  return Property;
};
