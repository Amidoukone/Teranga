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

      // 🧾 Lien vers un service (optionnel)
      Transaction.belongsTo(models.Service, {
        foreignKey: 'serviceId',
        as: 'service',
        onDelete: 'SET NULL',
      });

      // 🔧 Lien vers une tâche (optionnel)
      Transaction.belongsTo(models.Task, {
        foreignKey: 'taskId',
        as: 'task',
        onDelete: 'SET NULL',
      });

      // 🏗️ 🆕 Lien vers un projet (optionnel)
      Transaction.belongsTo(models.Project, {
        foreignKey: 'projectId',
        as: 'project',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });

      // 🛒 Lien e-commerce (commande)
      Transaction.belongsTo(models.Order, {
        foreignKey: 'orderId', // attribut JS
        as: 'order',
        onDelete: 'SET NULL',
      });
    }
  }

  Transaction.init(
    {
      // 🔗 Clés étrangères
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      serviceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      taskId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

      // ⚙️ 🆕 Lien vers un projet
      projectId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'FK → projects.id (transaction liée à un projet)',
      },

      // ⚠️ Lien e-commerce (colonne réelle = order_id)
      orderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'order_id',
      },

      // 💰 Informations principales
      type: {
        type: DataTypes.ENUM('revenue', 'expense', 'commission', 'adjustment'),
        allowNull: false,
      },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency: { type: DataTypes.STRING(10), defaultValue: 'XOF' },
      paymentMethod: { type: DataTypes.STRING(50), allowNull: true },

      // 🔖 Statut transaction
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
      // ⚠️ Ne pas activer underscored — tes colonnes sont camelCase
      // underscored: true,

      indexes: [
        { fields: ['userId'] },
        { fields: ['serviceId'] },
        { fields: ['taskId'] },
        { fields: ['projectId'] }, // 🆕 index projet
        { fields: ['order_id'] },
        { fields: ['type'] },
        { fields: ['status'] },
      ],
    }
  );

  return Transaction;
};
