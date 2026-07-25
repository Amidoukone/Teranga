'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Associations existantes / futures
      // User.hasMany(models.Property, { foreignKey: 'ownerId', as: 'properties' });
      // User.hasMany(models.Service, { foreignKey: 'clientId', as: 'servicesRequested' });
      // User.hasMany(models.Service, { foreignKey: 'agentId', as: 'servicesAssigned' });
      User.hasMany(models.RecoveryCode, {
        foreignKey: 'userId',
        as: 'recoveryCodes',
      });

      if (models.Provider) {
        User.hasOne(models.Provider, {
          foreignKey: 'userId',
          as: 'providerProfile',
        });
      }
    }

    /**
     * 🔎 Helpers logiques (NON persistés)
     * Ces getters ne touchent pas à la DB
     */

    get isAdmin() {
      return this.role === 'admin';
    }

    get isMaster() {
      return (
        this.role === 'admin' &&
        (this.countryId !== null || this.regionId !== null)
      );
    }

    get isGlobalAdmin() {
      return this.role === 'admin' && !this.countryId && !this.regionId;
    }

    get isProvider() {
      return this.role === 'provider';
    }

    get isCategoryManager() {
      return this.role === 'category_manager';
    }
  }

  User.init(
    {
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },

      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      firstName: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Langue UI preferree (fr/en)
      language: {
        type: DataTypes.STRING(5),
        allowNull: true,
        defaultValue: 'fr',
      },

      // Ancien champ legacy (ISO pays)
      country: {
        type: DataTypes.STRING(2), // ex: ML, FR
        allowNull: true,
      },

      // ✅ NOUVEAU : scope géographique (multi-pays / franchise)
      countryId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'country_id',
      },

      regionId: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        field: 'region_id',
      },

      role: {
        // 'provider' et 'category_manager' ajoutés par la migration
        // 20260724103000 (ALTER ENUM ALGORITHM=INSTANT), voir
        // docs/DEV_SPEC_TERANGA_v3.md section 0.6.c.
        type: DataTypes.ENUM('client', 'agent', 'admin', 'provider', 'category_manager'),
        allowNull: false,
        defaultValue: 'client',
      },

      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      phoneVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
    }
  );

  return User;
};
