'use strict';

module.exports = {
  async up(q, S) {
    const columns = await q.describeTable('agent_capacities');
    if (!columns.available_until) await q.addColumn('agent_capacities', 'available_until', { type: S.DATE, allowNull: true });
    // Existing declarations are not evidence that an agent is still available.
    await q.sequelize.query('UPDATE agent_capacities SET available = false WHERE available_until IS NULL');
  },
  async down(q) { await q.removeColumn('agent_capacities', 'available_until'); },
};
