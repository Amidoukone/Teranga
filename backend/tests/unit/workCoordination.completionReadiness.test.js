'use strict';

jest.mock('../../models', () => ({
  ProjectPhase: { findAll: jest.fn(async () => []) },
  Task: { findAll: jest.fn(async () => []) },
  ProjectDocument: { findOne: jest.fn() },
  Evidence: { findOne: jest.fn() },
}));
jest.mock('../../src/services/missionCoordination.service', () => ({ normalizePolicy: jest.fn((p) => p) }));
jest.mock('../../src/services/agentCapacity.service', () => ({ reserveAgent: jest.fn(), agentLoad: jest.fn() }));
jest.mock('../../src/services/coordinationSupervision.service', () => ({ raiseEscalation: jest.fn(), remindEscalation: jest.fn() }));
jest.mock('../../src/services/notification.service', () => ({ invalidateNotificationSummary: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));

const { Evidence } = require('../../models');
const { completionReadiness } = require('../../src/services/workCoordination.service');

describe('completionReadiness — order proof kind filter', () => {
  beforeEach(() => jest.clearAllMocks());

  test('only queries photo/document evidence kinds for an order, excluding receipts', async () => {
    Evidence.findOne.mockResolvedValue(null);
    await completionReadiness('order', 42, { id: 7 });
    expect(Evidence.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orderId: 42, uploaderId: 7, kind: { [require('sequelize').Op.in]: ['photo', 'document'] } }),
    }));
  });

  test('a payment receipt alone does not satisfy delivery proof (the query excludes it, Evidence.findOne returns null)', async () => {
    Evidence.findOne.mockResolvedValue(null);
    const state = await completionReadiness('order', 42, { id: 7 });
    expect(state.hasProof).toBe(false);
  });

  test('a photo proof satisfies delivery readiness', async () => {
    Evidence.findOne.mockResolvedValue({ id: 99 });
    const state = await completionReadiness('order', 42, { id: 7 });
    expect(state.hasProof).toBe(true);
    expect(state.proofId).toBe(99);
  });
});
