'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((table) => typeof table === 'string' ? table : table.tableName);
    if (!tables.includes('operation_scheduler_states')) {
      await queryInterface.createTable('operation_scheduler_states', {
        key: { type: Sequelize.STRING(60), primaryKey: true },
        started_at: { type: Sequelize.DATE, allowNull: false },
        last_success_at: { type: Sequelize.DATE, allowNull: true },
        last_error: { type: Sequelize.STRING(200), allowNull: true },
      });
      await queryInterface.bulkInsert('operation_scheduler_states', [{ key: 'mission_coordination', started_at: new Date(), last_success_at: null, last_error: null }]);
    }
    if (tables.includes('mission_coordinations')) {
      const columns = await queryInterface.describeTable('mission_coordinations');
      if (!columns.completion_report) await queryInterface.addColumn('mission_coordinations', 'completion_report', { type: Sequelize.JSON, allowNull: true });
      return;
    }
    // Les anciennes installations utilisent des identifiants signés ou non signés.
    const services = await queryInterface.describeTable('services');
    const users = await queryInterface.describeTable('users');
    const referenceType = (column) => /UNSIGNED/i.test(column.type) ? Sequelize.INTEGER.UNSIGNED : Sequelize.INTEGER;
    await queryInterface.createTable('mission_coordinations', {
      id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      service_id: { type: referenceType(services.id), allowNull: false, unique: true, references: { model: 'services', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      owner_user_id: { type: referenceType(users.id), allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      mode: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'manual' },
      state: { type: Sequelize.STRING(25), allowNull: false, defaultValue: 'waiting' },
      observed_status: { type: Sequelize.STRING(40), allowNull: true },
      policy: { type: Sequelize.JSON, allowNull: false },
      attempts: { type: Sequelize.JSON, allowNull: false },
      completion_report: { type: Sequelize.JSON, allowNull: true },
      next_action_at: { type: Sequelize.DATE, allowNull: true },
      reason: { type: Sequelize.STRING(100), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('mission_coordinations', ['state', 'next_action_at'], { name: 'idx_coordination_due' });
    await queryInterface.addIndex('mission_coordinations', ['owner_user_id'], { name: 'idx_coordination_owner' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('mission_coordinations');
    await queryInterface.dropTable('operation_scheduler_states');
  },
};
