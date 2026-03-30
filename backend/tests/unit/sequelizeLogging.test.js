'use strict';

const {
  runWithRequestPerf,
  snapshotRequestPerf,
  recordSqlQuery,
} = require('../../src/utils/requestPerf');
const {
  composeSequelizeLogging,
  toRoundedMs,
} = require('../../src/utils/sequelizeLogging');

describe('sequelize logging composition', () => {
  test('preserves timing-aware base logging so request perf keeps db timings', () => {
    const debug = jest.fn();
    const baseLogging = jest.fn((sql, timingMs) => {
      recordSqlQuery(sql, timingMs);
    });
    const wrappedLogging = composeSequelizeLogging(baseLogging, { debug });

    let perfSnapshot = null;
    runWithRequestPerf({ requestId: 'req-test' }, () => {
      wrappedLogging('SELECT 1', 37.456);
      perfSnapshot = snapshotRequestPerf();
    });

    expect(baseLogging).toHaveBeenCalledWith('SELECT 1', 37.456);
    expect(perfSnapshot.dbQueryCount).toBe(1);
    expect(perfSnapshot.dbDurationMs).toBe(37.46);
    expect(perfSnapshot.maxDbQueryMs).toBe(37.46);
    expect(debug).toHaveBeenCalledWith(
      { sql: 'SELECT 1', durationMs: 37.46 },
      'sequelize.query'
    );
  });

  test('rounds positive timings and ignores invalid values', () => {
    expect(toRoundedMs(12.345)).toBe(12.35);
    expect(toRoundedMs(-1)).toBeNull();
    expect(toRoundedMs('invalid')).toBeNull();
  });
});
