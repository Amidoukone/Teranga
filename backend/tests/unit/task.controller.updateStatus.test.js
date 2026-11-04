'use strict';

jest.mock('../../models', () => ({
  Task: { findByPk: jest.fn() },
  Service: {},
  User: {},
  Property: {},
  Country: {},
  TradeCategory: {},
}));
jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScopeForModel: jest.fn((where) => where),
  canAccessGeoResource: jest.fn(() => true),
}));
jest.mock('../../src/services/notification.service', () => ({
  getAdminRecipientIds: jest.fn(async () => []),
  computeProgress: jest.fn(() => 0),
}));
jest.mock('../../src/services/activity.service', () => ({ emitEvent: jest.fn(async () => {}) }));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { Task } = require('../../models');
const controller = require('../../src/controllers/task.controller');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function makeTask(status, overrides = {}) {
  return {
    id: 5,
    status,
    title: 'Relever le compteur',
    creatorId: 1,
    assignedTo: 2,
    countryId: 1,
    regionId: null,
    update: jest.fn(async (fields) => Object.assign(this, fields)),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('task.controller updateStatus — cancellation reachability', () => {
  test('a client can cancel their own task before it starts', async () => {
    const task = makeTask('created', { creatorId: 1 });
    task.update = jest.fn(async (fields) => Object.assign(task, fields));
    Task.findByPk.mockResolvedValue(task);
    const req = { user: { id: 1, role: 'client' }, params: { id: '5' }, body: { status: 'cancelled' } };
    const res = makeRes();
    await controller.updateStatus(req, res);
    expect(task.update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('cancellation remains reachable once the task is already in progress', async () => {
    const task = makeTask('in_progress', { creatorId: 1 });
    task.update = jest.fn(async (fields) => Object.assign(task, fields));
    Task.findByPk.mockResolvedValue(task);
    const req = { user: { id: 1, role: 'client' }, params: { id: '5' }, body: { status: 'cancelled' } };
    const res = makeRes();
    await controller.updateStatus(req, res);
    expect(task.update).toHaveBeenCalledWith({ status: 'cancelled' });
  });

  test('a completed task can no longer be cancelled', async () => {
    const task = makeTask('completed', { creatorId: 1 });
    Task.findByPk.mockResolvedValue(task);
    const req = { user: { id: 1, role: 'client' }, params: { id: '5' }, body: { status: 'cancelled' } };
    const res = makeRes();
    await controller.updateStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(task.update).not.toHaveBeenCalled();
  });

  test('cancelled stays terminal: no further transition is allowed out of it', async () => {
    const task = makeTask('cancelled', { creatorId: 1 });
    Task.findByPk.mockResolvedValue(task);
    const req = { user: { id: 1, role: 'client' }, params: { id: '5' }, body: { status: 'in_progress' } };
    const res = makeRes();
    await controller.updateStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(task.update).not.toHaveBeenCalled();
  });

  test('a client cannot cancel a task created by someone else', async () => {
    const task = makeTask('created', { creatorId: 99 });
    Task.findByPk.mockResolvedValue(task);
    const req = { user: { id: 1, role: 'client' }, params: { id: '5' }, body: { status: 'cancelled' } };
    const res = makeRes();
    await controller.updateStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(task.update).not.toHaveBeenCalled();
  });
});
