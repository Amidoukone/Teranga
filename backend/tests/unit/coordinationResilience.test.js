'use strict';

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../src/services/missionCoordination.service', () => ({ runMissionCoordination: jest.fn() }));
jest.mock('../../src/services/workCoordination.service', () => ({ runWorkCoordination: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn() }));
const cron = require('node-cron');
const { runMissionCoordination } = require('../../src/services/missionCoordination.service');
const { runWorkCoordination } = require('../../src/services/workCoordination.service');
const { startMissionCoordinationJob, stopMissionCoordinationJob } = require('../../src/jobs/missionCoordination.job');

afterEach(() => { stopMissionCoordinationJob(); jest.clearAllMocks(); });
test('a failed mission worker does not prevent work supervision or later cron runs', async () => {
  const previous = process.env.MISSION_COORDINATION_ENABLED;
  delete process.env.MISSION_COORDINATION_ENABLED;
  try {
    let tick;
    cron.schedule.mockImplementation((_pattern, run) => { tick = run; return { stop: jest.fn() }; });
    runMissionCoordination.mockRejectedValueOnce(new Error('Mission worker unavailable')).mockResolvedValue({});
    runWorkCoordination.mockResolvedValue({});
    startMissionCoordinationJob();
    await tick();
    expect(runWorkCoordination).toHaveBeenCalledTimes(1);
    await tick();
    expect(runMissionCoordination).toHaveBeenCalledTimes(2);
    expect(runWorkCoordination).toHaveBeenCalledTimes(2);
  } finally {
    if (previous === undefined) delete process.env.MISSION_COORDINATION_ENABLED;
    else process.env.MISSION_COORDINATION_ENABLED = previous;
  }
});

test('the expiry migration is additive and does not alter assigned work', async () => {
  const migration = require('../../migrations/20261023180000-add-agent-availability-expiry');
  const q = { describeTable: jest.fn().mockResolvedValue({}), addColumn: jest.fn(), sequelize: { query: jest.fn() } };
  const S = { DATE: 'DATE' };
  await migration.up(q, S);
  expect(q.addColumn).toHaveBeenCalledWith('agent_capacities', 'available_until', { type: 'DATE', allowNull: true });
  expect(q.sequelize.query).toHaveBeenCalledWith('UPDATE agent_capacities SET available = false WHERE available_until IS NULL');
});
