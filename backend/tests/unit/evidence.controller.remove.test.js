'use strict';

jest.mock('../../models', () => ({
  Evidence: { findByPk: jest.fn() },
  Task: {},
  Service: {},
  Property: {},
  User: {},
  Order: {},
}));
jest.mock('../../src/services/mediaUpload.service', () => ({ isImageKitEnabled: jest.fn(() => false) }));
jest.mock('../../src/helpers/teranga-imagekit', () => ({ deleteFile: jest.fn(async () => {}) }));
jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScopeForModel: jest.fn((where) => where),
  canAccessGeoResource: jest.fn(() => true),
  isGlobalAdmin: jest.fn(() => true),
}));
jest.mock('../../src/services/notification.service', () => ({
  getAdminRecipientIds: jest.fn(async () => []),
  computeProgress: jest.fn(() => 0),
}));
jest.mock('../../src/services/activity.service', () => ({ emitEvent: jest.fn(async () => {}) }));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));
jest.mock('fs', () => ({ promises: { unlink: jest.fn(async () => {}) } }));

const { Evidence } = require('../../models');
const imageKit = require('../../src/helpers/teranga-imagekit');
const controller = require('../../src/controllers/evidence.controller');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('evidence.controller remove — ImageKit cleanup', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deletes the ImageKit file using the correctly imported client (no ReferenceError)', async () => {
    Evidence.findByPk.mockResolvedValue({
      id: 10,
      fileId: 'imagekit-file-id',
      filePath: null,
      uploaderId: 1,
      createdAt: new Date(),
      destroy: jest.fn(async () => {}),
    });
    const req = { params: { id: '10' }, user: { id: 1, role: 'admin' } };
    const res = makeRes();

    await controller.remove(req, res);

    expect(imageKit.deleteFile).toHaveBeenCalledWith('imagekit-file-id');
    expect(res.status).not.toHaveBeenCalledWith(500);
  });
});
