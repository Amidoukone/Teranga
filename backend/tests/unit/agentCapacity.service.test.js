'use strict';

jest.mock('../../models', () => ({
  Service: { findAll: jest.fn(async () => []) },
  Project: { findAll: jest.fn(async () => []) },
  WorkCoordination: { findAll: jest.fn(async () => []) },
}));

const db = require('../../models');
const { agentLoadBatch } = require('../../src/services/agentCapacity.service');

describe('agentLoadBatch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns zero for every requested agent with no active work, in a single round of queries', async () => {
    const result = await agentLoadBatch([5, 6]);
    expect(result.get('5')).toBe(0);
    expect(result.get('6')).toBe(0);
    expect(db.Service.findAll).toHaveBeenCalledTimes(1);
    expect(db.Project.findAll).toHaveBeenCalledTimes(1);
    expect(db.WorkCoordination.findAll).toHaveBeenCalledTimes(1);
  });

  test('tallies load per agent across services, projects and order coordinations', async () => {
    db.Service.findAll.mockResolvedValue([{ agentId: 5 }, { agentId: 5 }]);
    db.Project.findAll.mockResolvedValue([{ agentId: 6 }]);
    db.WorkCoordination.findAll.mockResolvedValue([{ executorUserId: 5 }]);
    const result = await agentLoadBatch([5, 6]);
    expect(result.get('5')).toBe(3);
    expect(result.get('6')).toBe(1);
  });

  test('returns an empty map without querying when no agent ids are requested', async () => {
    const result = await agentLoadBatch([]);
    expect(result.size).toBe(0);
    expect(db.Service.findAll).not.toHaveBeenCalled();
  });
});
