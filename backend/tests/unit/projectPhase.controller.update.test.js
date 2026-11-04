'use strict';

jest.mock('../../models', () => ({
  Project: { findByPk: jest.fn() },
  ProjectPhase: { findByPk: jest.fn() },
}));
jest.mock('../../src/utils/geoScope', () => ({
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
  isGlobalAdmin: jest.fn(() => true),
  canAccessGeoResource: jest.fn(() => true),
}));
jest.mock('../../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn() }));

const { Project, ProjectPhase } = require('../../models');
const controller = require('../../src/controllers/projectPhase.controller');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('projectPhase.controller update — cross-tenant reassignment guard', () => {
  let phase;
  let ownProject;

  beforeEach(() => {
    jest.clearAllMocks();
    ownProject = { id: 10, clientId: 1, createdAt: new Date(), countryId: 1, regionId: null };
    phase = { id: 99, projectId: 10, title: 'Phase 1', update: jest.fn(async (fields) => Object.assign(phase, fields)) };
    ProjectPhase.findByPk.mockResolvedValue(phase);
    Project.findByPk.mockResolvedValue(ownProject);
  });

  test('rejects a request that moves the phase to a different project', async () => {
    const req = { user: { id: 1, role: 'client' }, params: { id: '99' }, body: { projectId: 55, title: 'Détournée' } };
    const res = makeRes();
    await controller.update(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(phase.update).not.toHaveBeenCalled();
  });

  test('accepts a request that merely re-sends the phase own project id', async () => {
    const req = { user: { id: 1, role: 'client' }, params: { id: '99' }, body: { projectId: 10, title: 'Titre corrigé' } };
    const res = makeRes();
    await controller.update(req, res);
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(phase.update).toHaveBeenCalledWith({ title: 'Titre corrigé' });
  });

  test('accepts a request without projectId at all', async () => {
    const req = { user: { id: 1, role: 'client' }, params: { id: '99' }, body: { title: 'Autre titre' } };
    const res = makeRes();
    await controller.update(req, res);
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(phase.update).toHaveBeenCalledWith({ title: 'Autre titre' });
  });
});
