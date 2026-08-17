'use strict';

const created = [];

jest.mock('../../models', () => ({
  sequelize: { transaction: jest.fn((fn) => fn({ __fake: true })) },
  MissionStatusHistory: {
    create: jest.fn((payload) => {
      created.push(payload);
      return Promise.resolve(payload);
    }),
  },
}));

const { isValidTransition, transitionMissionStatus, LEGACY_STATUS_MAP, TRANSITIONS } =
  require('../../src/services/missionStatus.service');
const { MissionStatusHistory, sequelize } = require('../../models');

function makeService(overrides = {}) {
  return {
    id: 1,
    missionStatus: 'ASSIGNED',
    status: 'in_progress',
    update: jest.fn(function (fields) {
      Object.assign(this, fields);
      return Promise.resolve(this);
    }),
    reload: jest.fn(function () {
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

describe('missionStatus.service', () => {
  beforeEach(() => {
    created.length = 0;
    jest.clearAllMocks();
  });

  test('isValidTransition follows the section 2 graph', () => {
    expect(isValidTransition('CREATED', 'SEARCHING_EXECUTOR')).toBe(true);
    expect(isValidTransition('CREATED', 'ASSIGNED')).toBe(false);
    expect(isValidTransition('ASSIGNED', 'EN_ROUTE')).toBe(true);
    expect(isValidTransition('ASSIGNED', 'COMPLETED')).toBe(false);
    expect(isValidTransition('COMPLETED', 'VALIDATED')).toBe(true);
    expect(isValidTransition('COMPLETED', 'DISPUTED')).toBe(true);
    expect(isValidTransition('CLOSED', 'CREATED')).toBe(false);
  });

  test('isValidTransition allows the additive "unassign" edge back to SEARCHING_EXECUTOR', () => {
    expect(isValidTransition('ASSIGNED', 'SEARCHING_EXECUTOR')).toBe(true);
    expect(isValidTransition('EN_ROUTE', 'SEARCHING_EXECUTOR')).toBe(true);
    // Pas d'arête retour depuis ON_SITE/IN_PROGRESS — désassignation refusée à ce stade
    // (voir mission.controller.js exports.assign).
    expect(isValidTransition('ON_SITE', 'SEARCHING_EXECUTOR')).toBe(false);
    expect(isValidTransition('IN_PROGRESS', 'SEARCHING_EXECUTOR')).toBe(false);
  });

  test('every transition target is a real key in LEGACY_STATUS_MAP or an untouched branch', () => {
    const untouched = [
      'CANCELLED_BY_CLIENT',
      'NO_EXECUTOR_FOUND',
      'DISPUTED',
      'RESOLVED_REFUND',
      'RESOLVED_REDO',
      'RESOLVED_CLOSED',
    ];
    Object.values(TRANSITIONS)
      .flat()
      .forEach((status) => {
        const hasMapping = Object.prototype.hasOwnProperty.call(LEGACY_STATUS_MAP, status);
        expect(hasMapping || untouched.includes(status)).toBe(true);
      });
  });

  test('rejects a mission with no missionStatus (classic agent flow)', async () => {
    const service = makeService({ missionStatus: null });
    await expect(
      transitionMissionStatus({ service, toStatus: 'ASSIGNED', actorType: 'admin', actorId: 1 })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('rejects an invalid transition', async () => {
    const service = makeService({ missionStatus: 'ASSIGNED' });
    await expect(
      transitionMissionStatus({ service, toStatus: 'COMPLETED', actorType: 'admin', actorId: 1 })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('rejects a stale guarded transition after reloading the locked row', async () => {
    const service = makeService({
      missionStatus: 'ASSIGNED',
      providerId: 8,
      acceptanceDeadlineAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    await expect(
      transitionMissionStatus({
        service,
        toStatus: 'SEARCHING_EXECUTOR',
        actorType: 'system',
        actorId: null,
        expectedFields: { providerId: 7 },
      })
    ).rejects.toMatchObject({ status: 409, code: 'STALE_MISSION_TRANSITION' });
  });

  test('writes the legacy-mapped status and a history row atomically for a valid transition', async () => {
    const service = makeService({ missionStatus: 'ASSIGNED', status: 'in_progress' });

    const updated = await transitionMissionStatus({
      service,
      toStatus: 'EN_ROUTE',
      actorType: 'provider',
      actorId: 7,
    });

    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ missionStatus: 'EN_ROUTE', status: 'in_progress' }),
      expect.objectContaining({ transaction: { __fake: true } })
    );
    expect(MissionStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 1,
        fromStatus: 'ASSIGNED',
        toStatus: 'EN_ROUTE',
        actorType: 'provider',
        actorId: 7,
      }),
      expect.objectContaining({ transaction: { __fake: true } })
    );
    expect(updated.missionStatus).toBe('EN_ROUTE');
  });

  test('never rewrites services.status for cancellation/dispute branches (0.6.b)', async () => {
    const service = makeService({ missionStatus: 'ASSIGNED', status: 'in_progress' });

    await transitionMissionStatus({
      service,
      toStatus: 'CANCELLED_BY_CLIENT',
      actorType: 'client',
      actorId: 3,
    });

    const updateCallArgs = service.update.mock.calls[0][0];
    expect(updateCallArgs.missionStatus).toBe('CANCELLED_BY_CLIENT');
    expect(updateCallArgs).not.toHaveProperty('status');
  });

  test('passes extraFields through to the same update call (e.g. providerId on assignment)', async () => {
    const service = makeService({ missionStatus: 'SEARCHING_EXECUTOR', status: 'created' });

    await transitionMissionStatus({
      service,
      toStatus: 'ASSIGNED',
      actorType: 'admin',
      actorId: 2,
      extraFields: { providerId: 42 },
    });

    expect(service.update).toHaveBeenCalledWith(
      expect.objectContaining({ missionStatus: 'ASSIGNED', status: 'in_progress', providerId: 42 }),
      expect.anything()
    );
  });
});
