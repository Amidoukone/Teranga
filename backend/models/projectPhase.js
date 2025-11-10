'use strict';

module.exports = (sequelize, DataTypes) => {
  const ProjectPhase = sequelize.define('ProjectPhase', {
    projectId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    startDate: { type: DataTypes.DATE },
    endDate: { type: DataTypes.DATE },
    status: { type: DataTypes.STRING, defaultValue: 'pending' }, // pending, active, completed
    progress: { type: DataTypes.INTEGER, defaultValue: 0 }, // % d’avancement
  }, { tableName: 'project_phases' });

  ProjectPhase.associate = (models) => {
    ProjectPhase.belongsTo(models.Project, { as: 'project', foreignKey: 'projectId', onDelete: 'CASCADE' });
  };

  return ProjectPhase;
};
