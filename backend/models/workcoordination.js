'use strict';
module.exports = (sequelize, D) => {
  const WorkCoordination = sequelize.define('WorkCoordination', {
    entityType: { type: D.STRING(20), allowNull: false, field: 'entity_type' },
    entityId: { type: D.INTEGER, allowNull: false, field: 'entity_id' },
    ownerUserId: { type: D.INTEGER, allowNull: true, field: 'owner_user_id' },
    executorUserId: { type: D.INTEGER, allowNull: true, field: 'executor_user_id' },
    mode: { type: D.STRING(20), allowNull: false, defaultValue: 'manual' },
    state: { type: D.STRING(25), allowNull: false, defaultValue: 'waiting' },
    observedStatus: { type: D.STRING(40), field: 'observed_status' },
    policy: { type: D.JSON, allowNull: false, defaultValue: {} },
    attempts: { type: D.JSON, allowNull: false, defaultValue: [] },
    nextActionAt: { type: D.DATE, field: 'next_action_at' }, reason: D.STRING(100),
  }, { tableName: 'work_coordinations', underscored: true, indexes: [{ unique: true, fields: ['entity_type', 'entity_id'] }] });
  WorkCoordination.associate = (models) => {
    WorkCoordination.belongsTo(models.User, { as: 'owner', foreignKey: 'ownerUserId' });
    WorkCoordination.belongsTo(models.User, { as: 'executor', foreignKey: 'executorUserId' });
    for (const [type, Model] of [['project', models.Project], ['order', models.Order]]) {
      Model.hasOne(WorkCoordination, { as: 'workCoordination', foreignKey: 'entityId', constraints: false, scope: { entity_type: type } });
      Model.addHook('afterDestroy', 'removeWorkCoordination', async (resource, options) => {
        await WorkCoordination.destroy({ where: { entityType: type, entityId: resource.id }, transaction: options.transaction });
      });
    }
  };
  return WorkCoordination;
};
