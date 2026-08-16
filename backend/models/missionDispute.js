'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MissionDispute extends Model {
    static associate(models) {
      MissionDispute.belongsTo(models.Service, { foreignKey: 'serviceId', as: 'service' });
      MissionDispute.belongsTo(models.User, { foreignKey: 'openedBy', as: 'client' });
      MissionDispute.belongsTo(models.User, { foreignKey: 'handledBy', as: 'handler' });
    }
  }

  MissionDispute.init(
    {
      serviceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'service_id' },
      openedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'opened_by' },
      reason: {
        type: DataTypes.ENUM('non_conforme', 'retard', 'comportement', 'autre'),
        allowNull: false,
      },
      description: { type: DataTypes.TEXT, allowNull: false },
      clientEvidence: { type: DataTypes.JSON, allowNull: true, field: 'client_evidence' },
      status: {
        type: DataTypes.ENUM('open', 'investigating', 'resolved'),
        allowNull: false,
        defaultValue: 'open',
      },
      resolution: {
        type: DataTypes.ENUM('refund', 'redo', 'closed'),
        allowNull: true,
      },
      resolutionNotes: { type: DataTypes.TEXT, allowNull: true, field: 'resolution_notes' },
      handledBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'handled_by' },
      firstContactAt: { type: DataTypes.DATE, allowNull: true, field: 'first_contact_at' },
      firstContactReminderSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'first_contact_reminder_sent_at',
      },
      decidedAt: { type: DataTypes.DATE, allowNull: true, field: 'decided_at' },
      updateReminderSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'update_reminder_sent_at',
      },
      escalatedAt: { type: DataTypes.DATE, allowNull: true, field: 'escalated_at' },
    },
    {
      sequelize,
      modelName: 'MissionDispute',
      tableName: 'mission_disputes',
      underscored: true,
      indexes: [{ fields: ['service_id'] }, { fields: ['status'] }],
    }
  );

  return MissionDispute;
};
