'use strict';
const { Model } = require('sequelize');

function toNullableNumber(v) {
  return (v === '' || v === undefined || v === null) ? null : v;
}

module.exports = (sequelize, DataTypes) => {
  class Property extends Model {
    static associate(models) {
      // Relation : un bien appartient à un utilisateur (propriétaire)
      Property.belongsTo(models.User, { foreignKey: 'ownerId', as: 'owner' });
    }
  }

  Property.init({
    ownerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: DataTypes.TEXT,
    type: {
      type: DataTypes.ENUM('house', 'apartment', 'land', 'commercial'),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      set(value) {
        this.setDataValue('latitude', toNullableNumber(value));
      }
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      set(value) {
        this.setDataValue('longitude', toNullableNumber(value));
      }
    },
    surfaceArea: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      set(value) {
        this.setDataValue('surfaceArea', toNullableNumber(value));
      }
    },
    roomCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      set(value) {
        this.setDataValue('roomCount', toNullableNumber(value));
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'sold'),
      defaultValue: 'active'
    },

    // ✅ Nouvelle colonne photos
    photos: {
      type: DataTypes.JSON,   // MySQL 5.7+ support JSON
      allowNull: true,
      defaultValue: []        // liste vide si aucun fichier
    }
  }, {
    sequelize,
    modelName: 'Property',
    tableName: 'properties'   // ✅ cohérent avec ta DB (minuscule)
  });

  return Property;
};
