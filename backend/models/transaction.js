'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Transaction extends Model {
    static associate(models) {
      // 👤 Lien utilisateur (obligatoire)
      Transaction.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
      });

      // 🧾 Liens fonctionnels existants
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

      // 🛒 Lien e-commerce (FK stockée en DB sous order_id)
      Transaction.belongsTo(models.Order, {
        foreignKey: 'orderId', // attribut JS
        as: 'order',
        onDelete: 'SET NULL',
      });
    }
  }

  Transaction.init(
    {
      // 🔗 Clés étrangères (colonnes camelCase existantes)
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      serviceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      taskId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // ⚠️ Spécifique : la colonne réelle est `order_id`
      orderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'order_id',
      },

      // 💰 Infos principales
      type: {
        type: DataTypes.ENUM('revenue', 'expense', 'commission', 'adjustment'),
        allowNull: false,
      },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency: { type: DataTypes.STRING(10), defaultValue: 'XOF' },
      paymentMethod: { type: DataTypes.STRING(50), allowNull: true },

      // 🔖 Statut
      status: {
        type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
        defaultValue: 'pending',
      },

      // 📝 Métadonnées
      description: { type: DataTypes.TEXT, allowNull: true },
      proofFile: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Transaction',
      tableName: 'transactions',
      // IMPORTANT : on ne force pas underscored, ta table est camelCase (createdAt/updatedAt, userId, etc.)
      // underscored: true, // ⛔️ supprimé

      // Index alignés sur les noms de colonnes RÉELS
      indexes: [
        { fields: ['userId'] },
        { fields: ['serviceId'] },
        { fields: ['taskId'] },
        { fields: ['order_id'] }, // colonne réelle en DB
        { fields: ['type'] },
        { fields: ['status'] },
      ],
    }
  );

  return Transaction;
};
