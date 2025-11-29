'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Transaction extends Model {
    static associate(models) {
      Transaction.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
      });

      Transaction.belongsTo(models.Service, {
        foreignKey: 'serviceId',
        as: 'service',
        onDelete: 'SET NULL',
      });

      Transaction.belongsTo(models.Task, {
        foreignKey: 'taskId',
        as: 'task',
        onDelete: 'SET NULL',
      });

      Transaction.belongsTo(models.Project, {
        foreignKey: 'projectId',
        as: 'project',
        onDelete: 'SET NULL',
      });

      Transaction.belongsTo(models.Order, {
        foreignKey: 'orderId',
        as: 'order',
        onDelete: 'SET NULL',
      });
    }
  }

  Transaction.init(
    {
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      serviceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      taskId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // 🆕 obligatoire dans ton controller
      projectId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Lien vers projet',
      },

      // ⚠ colonne réelle order_id en DB
      orderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'order_id',
      },

      type: {
        type: DataTypes.ENUM('revenue', 'expense', 'commission', 'adjustment'),
        allowNull: false,
      },

      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'XOF',
      },

      // 🆕 manquait dans migration
      paymentMethod: { type: DataTypes.STRING(50), allowNull: true },

      status: {
        type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },

      description: { type: DataTypes.TEXT, allowNull: true },

      /**
       * Preuve de paiement (JSON)
       * {
       *   path: "https://ik.imagekit.io/...jpg",
       *   fileId: "...",
       *   originalName: "...",
       *   mimeType: "...",
       *   size: 12345
       * }
       */
      proofFile: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Transaction',
      tableName: 'transactions',

      indexes: [
        { fields: ['userId'] },
        { fields: ['serviceId'] },
        { fields: ['taskId'] },
        { fields: ['projectId'] },
        { fields: ['order_id'] },
        { fields: ['type'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
      ],
    }
  );

  return Transaction;
};
