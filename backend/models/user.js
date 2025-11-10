'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Exemple d’associations futures :
      // User.hasMany(models.Property, { foreignKey: 'ownerId', as: 'properties' });
      // User.hasMany(models.Service, { foreignKey: 'clientId', as: 'servicesRequested' });
      // User.hasMany(models.Service, { foreignKey: 'agentId', as: 'servicesAssigned' });
    }
  }

  User.init(
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      country: {
        type: DataTypes.STRING(2), // code pays (ex: ML, FR…)
        allowNull: true
      },
      role: {
        type: DataTypes.ENUM('client', 'agent', 'admin'),
        allowNull: false,
        defaultValue: 'client' // par défaut lors de l'inscription publique
      },
      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      phoneVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users' // ✅ correspond à ta DB (minuscule)
    }
  );

  return User;
};
