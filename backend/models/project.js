'use strict';
module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define('Project', {
    title: { type: DataTypes.STRING, allowNull: false },
    type:  { type: DataTypes.STRING, allowNull: false }, // immobilier, agricole, etc.
    description: { type: DataTypes.TEXT },
    budget: { type: DataTypes.DECIMAL(12, 2) },
    currency: { type: DataTypes.STRING(5), defaultValue: 'XOF' },
    status: { type: DataTypes.STRING, defaultValue: 'created' }, // created, in_progress, completed, validated
    clientId: { type: DataTypes.INTEGER, allowNull: false },
    agentId:  { type: DataTypes.INTEGER, allowNull: true },
  }, { tableName: 'projects' });

  Project.associate = (models) => {
    Project.belongsTo(models.User, { as: 'client', foreignKey: 'clientId' });
    Project.belongsTo(models.User, { as: 'agent', foreignKey: 'agentId' });
    Project.hasMany(models.ProjectPhase,    { as: 'phases',    foreignKey: 'projectId', onDelete: 'CASCADE' });
    Project.hasMany(models.Task,            { as: 'tasks',     foreignKey: 'projectId', onDelete: 'SET NULL' });
    Project.hasMany(models.ProjectDocument, { as: 'documents', foreignKey: 'projectId', onDelete: 'CASCADE' });
  };

  return Project;
};
