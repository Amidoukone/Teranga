'use strict';

jest.mock('../../models', () => ({
  Service: { findAll: jest.fn() },
  TradeCategory: { findAll: jest.fn() },
  MissionStatusHistory: { findAll: jest.fn() },
}));
jest.mock('../../src/services/notification.service', () => ({ getAdminRecipientIds: jest.fn(async () => [1]) }));
jest.mock('../../src/services/activity.service', () => ({ emitEvent: jest.fn(async () => {}) }));
jest.mock('../../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { Service, TradeCategory, MissionStatusHistory } = require('../../models');
const { emitEvent } = require('../../src/services/activity.service');
const { runMissionThresholdCheck } = require('../../src/jobs/missionThresholdCheck.job');

function makeService(overrides) {
  return { id: 1, missionStatus: 'ASSIGNED', tradeCategoryId: 10, countryId: 1, regionId: null, update: jest.fn(async () => {}), ...overrides };
}

describe('runMissionThresholdCheck — batched lookups', () => {
  beforeEach(() => jest.clearAllMocks());

  test('queries trade categories and history once, regardless of candidate count', async () => {
    const services = [makeService({ id: 1 }), makeService({ id: 2 }), makeService({ id: 3, tradeCategoryId: 20 })];
    Service.findAll.mockResolvedValue(services);
    TradeCategory.findAll.mockResolvedValue([
      { id: 10, name: 'Plomberie', alertThresholdMinutes: 30 },
      { id: 20, name: 'Électricité', alertThresholdMinutes: 30 },
    ]);
    const old = new Date(Date.now() - 60 * 60000);
    MissionStatusHistory.findAll.mockResolvedValue([
      { serviceId: 1, createdAt: old },
      { serviceId: 2, createdAt: old },
      { serviceId: 3, createdAt: old },
    ]);

    const report = await runMissionThresholdCheck();

    expect(TradeCategory.findAll).toHaveBeenCalledTimes(1);
    expect(MissionStatusHistory.findAll).toHaveBeenCalledTimes(1);
    expect(report.checked).toBe(3);
    expect(report.alertsSent).toBe(3);
    expect(emitEvent).toHaveBeenCalledTimes(3);
  });

  test('skips a mission whose trade category has no alert threshold configured, and surfaces it in the report', async () => {
    Service.findAll.mockResolvedValue([makeService()]);
    TradeCategory.findAll.mockResolvedValue([{ id: 10, name: 'Plomberie', alertThresholdMinutes: null }]);
    MissionStatusHistory.findAll.mockResolvedValue([{ serviceId: 1, createdAt: new Date(Date.now() - 60 * 60000) }]);

    const report = await runMissionThresholdCheck();

    expect(report.alertsSent).toBe(0);
    expect(emitEvent).not.toHaveBeenCalled();
    // Avant le correctif, une filière mal configurée (seuil manquant) ne laissait aucune trace.
    expect(report.skippedNoThreshold).toBe(1);
    expect(report.tradeCategoryIdsWithoutThreshold).toEqual(['10']);
  });

  test('skips a mission that has not yet reached its threshold', async () => {
    Service.findAll.mockResolvedValue([makeService()]);
    TradeCategory.findAll.mockResolvedValue([{ id: 10, name: 'Plomberie', alertThresholdMinutes: 30 }]);
    MissionStatusHistory.findAll.mockResolvedValue([{ serviceId: 1, createdAt: new Date() }]);

    const report = await runMissionThresholdCheck();

    expect(report.alertsSent).toBe(0);
  });

  test('a mission with no status history at all is never alerted', async () => {
    Service.findAll.mockResolvedValue([makeService()]);
    TradeCategory.findAll.mockResolvedValue([{ id: 10, name: 'Plomberie', alertThresholdMinutes: 30 }]);
    MissionStatusHistory.findAll.mockResolvedValue([]);

    const report = await runMissionThresholdCheck();

    expect(report.alertsSent).toBe(0);
  });
});
