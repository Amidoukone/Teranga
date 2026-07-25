'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProviderContract extends Model {
    static associate(models) {
      ProviderContract.belongsTo(models.Provider, {
        foreignKey: 'providerId',
        as: 'provider',
      });
    }
  }

  ProviderContract.init(
    {
      providerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'provider_id',
      },
      commissionRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        field: 'commission_rate',
      },
      nonCircumventionMonths: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 12,
        field: 'non_circumvention_months',
      },
      signedAt: { type: DataTypes.DATE, allowNull: false, field: 'signed_at' },
      documentUrl: { type: DataTypes.STRING(255), allowNull: true, field: 'document_url' },
      status: {
        type: DataTypes.ENUM('active', 'terminated'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      sequelize,
      modelName: 'ProviderContract',
      tableName: 'provider_contracts',
      underscored: true,
      indexes: [{ fields: ['provider_id'] }, { fields: ['status'] }],
    }
  );

  return ProviderContract;
};
