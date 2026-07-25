'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Provider extends Model {
    static associate(models) {
      Provider.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

      if (models.Country) {
        Provider.belongsTo(models.Country, {
          foreignKey: 'countryCode',
          targetKey: 'isoCode',
          as: 'country',
        });
      }

      if (models.TradeCategory && models.ProviderTradeCategory) {
        Provider.belongsToMany(models.TradeCategory, {
          through: models.ProviderTradeCategory,
          foreignKey: 'providerId',
          otherKey: 'tradeCategoryId',
          as: 'tradeCategories',
        });
      }

      if (models.Service) {
        Provider.hasMany(models.Service, {
          foreignKey: 'providerId',
          as: 'services',
        });
      }
    }

    /**
     * DTO public (13.6.1/13.7 de la spec) : ne jamais renvoyer phone_number,
     * email ou legal_name à un client. À utiliser explicitement dans les
     * serializers/contrôleurs qui exposent un provider à un rôle 'client'.
     */
    toPublicDTO() {
      return {
        id: this.id,
        displayFirstName: this.displayFirstName,
        averageRating: this.averageRating,
        completedMissionsCount: this.completedMissionsCount,
        badgeCertified: this.badgeCertified,
      };
    }
  }

  Provider.init(
    {
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        field: 'user_id',
      },

      type: {
        type: DataTypes.ENUM('independent', 'company'),
        allowNull: false,
      },

      legalName: { type: DataTypes.STRING(150), allowNull: true, field: 'legal_name' },
      displayFirstName: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: 'display_first_name',
      },
      rccmNumber: { type: DataTypes.STRING(50), allowNull: true, field: 'rccm_number' },

      phoneNumber: {
        type: DataTypes.STRING(30),
        allowNull: false,
        field: 'phone_number',
      },
      email: { type: DataTypes.STRING(150), allowNull: true },

      countryCode: {
        type: DataTypes.STRING(2),
        allowNull: false,
        field: 'country_code',
      },

      status: {
        type: DataTypes.ENUM('pending', 'probation', 'active', 'suspended', 'revoked'),
        allowNull: false,
        defaultValue: 'pending',
      },

      averageRating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        field: 'average_rating',
      },
      completedMissionsCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: 'completed_missions_count',
      },

      hasLiabilityInsurance: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'has_liability_insurance',
      },
      insuranceExpiresAt: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'insurance_expires_at',
      },

      badgeCertified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'badge_certified',
      },
    },
    {
      sequelize,
      modelName: 'Provider',
      tableName: 'providers',
      underscored: true,
      indexes: [
        { fields: ['country_code'] },
        { fields: ['status'] },
        { fields: ['type'] },
      ],
    }
  );

  return Provider;
};
