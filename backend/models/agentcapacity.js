'use strict';
module.exports = (sequelize, D) => {
  const AgentCapacity = sequelize.define('AgentCapacity', {
    userId: { type: D.INTEGER, primaryKey: true, field: 'user_id' },
    available: { type: D.BOOLEAN, allowNull: false, defaultValue: false },
    maxConcurrent: { type: D.INTEGER, allowNull: false, defaultValue: 1, field: 'max_concurrent' },
    lastAssignedAt: { type: D.DATE, allowNull: true, field: 'last_assigned_at' },
  }, { tableName: 'agent_capacities', underscored: true });
  AgentCapacity.associate = (models) => AgentCapacity.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
  return AgentCapacity;
};
