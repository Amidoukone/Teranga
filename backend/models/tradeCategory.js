'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TradeCategory extends Model {
    static associate(models) {
      if (models.Provider && models.ProviderTradeCategory) {
        TradeCategory.belongsToMany(models.Provider, {
          through: models.ProviderTradeCategory,
          foreignKey: 'tradeCategoryId',
          otherKey: 'providerId',
          as: 'providers',
        });
      }

      if (models.Service) {
        TradeCategory.hasMany(models.Service, {
          foreignKey: 'tradeCategoryId',
          as: 'services',
        });
      }

      if (models.ServiceDefinition) {
        TradeCategory.hasOne(models.ServiceDefinition, {
          foreignKey: 'legacyTradeCategoryId',
          as: 'serviceDefinition',
        });
      }

      if (models.User && models.CategoryManagerTradeCategory) {
        TradeCategory.belongsToMany(models.User, {
          through: models.CategoryManagerTradeCategory,
          foreignKey: 'tradeCategoryId',
          otherKey: 'userId',
          as: 'categoryManagers',
        });
      }

      // Scope géo (associations logiques uniquement, pas de FK DB — même pattern que
      // Service.belongsTo(Country/Region), voir models/service.js) : NULL = filière globale.
      if (models.Country) {
        TradeCategory.belongsTo(models.Country, {
          foreignKey: 'countryId',
          as: 'country',
        });
      }

      if (models.Region) {
        TradeCategory.belongsTo(models.Region, {
          foreignKey: 'regionId',
          as: 'region',
        });
      }
    }
  }

  TradeCategory.init(
    {
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      requiresCompany: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'requires_company',
      },
      defaultWarrantyDays: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: 'default_warranty_days',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
      },
      // NULL = filière globale (visible/disponible partout, comportement historique des 7
      // filières par défaut). countryId seul = disponible dans tout le pays. countryId +
      // regionId = limitée à cette région. Un master (admin scopé) ne peut créer/gérer que des
      // filières dans SON propre périmètre (voir tradeCategory.controller.js) ; seul l'admin
      // global peut créer une filière globale ou choisir un périmètre arbitraire.
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
      // Seuils de professionnalisme (docs/DEV_SPEC_TERANGA_v4_PHASE0.md §1) — NULL = filière
      // jamais vérifiée par le job d'alerte (pas de valeur par défaut arbitraire imposée).
      intakeThresholdMinutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'intake_threshold_minutes',
      },
      alertThresholdMinutes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'alert_threshold_minutes',
      },
    },
    {
      sequelize,
      modelName: 'TradeCategory',
      tableName: 'trade_categories',
      underscored: true,
      indexes: [
        { fields: ['slug'], unique: true },
        { fields: ['is_active'] },
        { fields: ['country_id'] },
        { fields: ['region_id'] },
      ],
    }
  );

  return TradeCategory;
};
