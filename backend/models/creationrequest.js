'use strict';
module.exports = (sequelize, D) => sequelize.define('CreationRequest', {
  id: { type: D.STRING(64), primaryKey: true },
  payloadHash: { type: D.STRING(64), allowNull: false, field: 'payload_hash' },
  state: { type: D.STRING(20), allowNull: false, defaultValue: 'pending' },
  resourceType: { type: D.STRING(20), field: 'resource_type' }, resourceId: { type: D.INTEGER, field: 'resource_id' },
}, { tableName: 'creation_requests', underscored: true });
