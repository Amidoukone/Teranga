'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'customer',
      });

      Order.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });

      Order.hasMany(models.OrderItem, {
        foreignKey: 'orderId',
        as: 'items',
      });

      Order.hasMany(models.Transaction, {
        foreignKey: 'orderId',
        as: 'transactions',
      });

      Order.hasMany(models.Evidence, {
        foreignKey: 'orderId',
        as: 'evidences',
      });

      if (models.Country) {
        Order.belongsTo(models.Country, {
          foreignKey: 'countryId',
          as: 'country',
        });
      }

      if (models.Region) {
        Order.belongsTo(models.Region, {
          foreignKey: 'regionId',
          as: 'region',
        });
      }
    }
  }

  Order.init(
    {
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },

      code: {
        type: DataTypes.STRING(40),
        allowNull: false,
        unique: true,
      },

      subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      shipping: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      tax: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      currency: { type: DataTypes.STRING(10), defaultValue: 'XOF' },

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

      status: {
        type: DataTypes.ENUM(
          'created',
          'processing',
          'paid',
          'shipped',
          'fulfilled',
          'delivered',
          'cancelled',
          'refunded'
        ),
        defaultValue: 'created',
      },

      paymentStatus: {
        type: DataTypes.ENUM('unpaid', 'paid', 'partial', 'refunded'),
        defaultValue: 'unpaid',
        field: 'payment_status',
      },

      paymentMethod: { type: DataTypes.STRING(50), field: 'payment_method' },
      paymentRef: { type: DataTypes.STRING(120), field: 'payment_ref' },

      shippingAddress: { type: DataTypes.JSON, field: 'shipping_address' },
      billingAddress: { type: DataTypes.JSON, field: 'billing_address' },
      notes: { type: DataTypes.TEXT },
    },
    {
      sequelize,
      modelName: 'Order',
      tableName: 'orders',
      timestamps: true, // ✅ createdAt / updatedAt camelCase
      indexes: [
        { fields: ['user_id'] },
        { fields: ['code'], unique: true },
        { fields: ['status'] },
        { fields: ['payment_status'] },
        { fields: ['country_id'] },
        { fields: ['region_id'] },
      ],
      hooks: {
        beforeValidate(order) {
          if (!order.code) {
            const d = new Date();
            order.code = `CMD-${d.getFullYear()}${String(
              d.getMonth() + 1
            ).padStart(2, '0')}${String(d.getDate()).padStart(
              2,
              '0'
            )}-${Math.floor(Math.random() * 10000)
              .toString()
              .padStart(4, '0')}`;
          }
        },
        beforeSave(order) {
          order.total =
            Number(order.subtotal || 0) +
            Number(order.tax || 0) +
            Number(order.shipping || 0);
        },
      },
    }
  );

  return Order;
};
