'use strict';

module.exports = {
  async up(q, S) {
    const tables = (await q.showAllTables()).map((table) => typeof table === 'string' ? table : table.tableName);
    const users = await q.describeTable('users');
    const userIdType = /UNSIGNED/i.test(users.id.type) ? S.INTEGER.UNSIGNED : S.INTEGER;
    if (!tables.includes('agent_capacities')) await q.createTable('agent_capacities', {
      user_id: { type: userIdType, primaryKey: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      available: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      max_concurrent: { type: S.INTEGER, allowNull: false, defaultValue: 1 },
      last_assigned_at: { type: S.DATE, allowNull: true },
      created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false },
    });
    if (!tables.includes('work_coordinations')) {
      await q.createTable('work_coordinations', {
        id: { type: S.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
        entity_type: { type: S.STRING(20), allowNull: false }, entity_id: { type: S.INTEGER, allowNull: false },
        owner_user_id: { type: userIdType, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        executor_user_id: { type: userIdType, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        mode: { type: S.STRING(20), allowNull: false, defaultValue: 'manual' },
        state: { type: S.STRING(25), allowNull: false, defaultValue: 'waiting' },
        observed_status: { type: S.STRING(40), allowNull: true },
        policy: { type: S.JSON, allowNull: false }, attempts: { type: S.JSON, allowNull: false },
        next_action_at: { type: S.DATE, allowNull: true }, reason: { type: S.STRING(100), allowNull: true },
        created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false },
      });
      await q.addIndex('work_coordinations', ['entity_type', 'entity_id'], { unique: true, name: 'work_coordination_entity' });
      await q.addIndex('work_coordinations', ['state', 'next_action_at'], { name: 'work_coordination_due' });
    }
    const [scheduler] = await q.sequelize.query("SELECT `key` FROM operation_scheduler_states WHERE `key` = 'work_coordination'");
    if (!scheduler.length) await q.bulkInsert('operation_scheduler_states', [{ key: 'work_coordination', started_at: new Date(), last_success_at: null, last_error: null }]);
    if (!tables.includes('creation_requests')) await q.createTable('creation_requests', {
      id: { type: S.STRING(64), primaryKey: true }, payload_hash: { type: S.STRING(64), allowNull: false },
      state: { type: S.STRING(20), allowNull: false, defaultValue: 'pending' },
      resource_type: { type: S.STRING(20), allowNull: true }, resource_id: { type: S.INTEGER, allowNull: true },
      created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false },
    });
  },
  async down(q) {
    await q.bulkDelete('operation_scheduler_states', { key: 'work_coordination' });
    await q.dropTable('creation_requests'); await q.dropTable('work_coordinations'); await q.dropTable('agent_capacities');
  },
};
