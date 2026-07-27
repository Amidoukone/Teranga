'use strict';

jest.mock('../../models', () => ({
  Service: { findByPk: jest.fn() },
  Evidence: { create: jest.fn(), findAll: jest.fn() },
  User: {},
  TradeCategory: {},
  SavedLocation: {},
}));

jest.mock('../../src/services/mediaUpload.service', () => ({
  isImageKitEnabled: jest.fn(),
  resolveLocalFallbackPolicy: jest.fn(),
  mediaStorageError: jest.fn((message, code) => {
    const err = new Error(message || 'storage unavailable');
    err.code = code;
    return err;
  }),
  buildFileName: jest.fn((prefix, name, idx) => `${prefix}_${idx}_${name}`),
  uploadToImageKitWithRetry: jest.fn(),
  saveFileLocally: jest.fn(),
  guessKind: jest.fn(),
}));

jest.mock('../../src/services/geocoding.service', () => ({ geocodeAddress: jest.fn() }));
jest.mock('../../src/services/priceEstimate.service', () => ({ estimateMission: jest.fn() }));
jest.mock('../../src/services/serviceNotification.service', () => ({
  notifyServiceCreated: jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Service, Evidence } = require('../../models');
const mediaUpload = require('../../src/services/mediaUpload.service');
const ctrl = require('../../src/controllers/mission.controller');

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('mission.controller.addAttachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects when the caller does not own the mission', async () => {
    Service.findByPk.mockResolvedValue({ id: 5, clientId: 99, countryId: null, regionId: null });

    const req = {
      params: { id: '5' },
      user: { id: 1 },
      files: { photo: [{ originalname: 'p.jpg', mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('x') }] },
    };
    const res = makeRes();

    await ctrl.addAttachments(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('rejects when no file is provided', async () => {
    Service.findByPk.mockResolvedValue({ id: 5, clientId: 1, countryId: null, regionId: null });

    const req = { params: { id: '5' }, user: { id: 1 }, files: {} };
    const res = makeRes();

    await ctrl.addAttachments(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('falls back to local storage when ImageKit is disabled, creates photo + voice note evidences', async () => {
    Service.findByPk.mockResolvedValue({ id: 5, clientId: 1, countryId: 3, regionId: null });
    mediaUpload.isImageKitEnabled.mockReturnValue(false);
    mediaUpload.resolveLocalFallbackPolicy.mockReturnValue({ allowLocalFallback: true });
    mediaUpload.saveFileLocally.mockImplementation(async (_file, fileName) => ({
      url: `/uploads/mission-attachments/${fileName}`,
      fileId: null,
    }));
    Evidence.create
      .mockResolvedValueOnce({ id: 101 })
      .mockResolvedValueOnce({ id: 102 });
    Evidence.findAll.mockResolvedValue([{ id: 101 }, { id: 102 }]);

    const req = {
      params: { id: '5' },
      user: { id: 1 },
      files: {
        photo: [{ originalname: 'p.jpg', mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('x') }],
        voiceNote: [{ originalname: 'v.webm', mimetype: 'audio/webm', size: 20, buffer: Buffer.from('y') }],
      },
    };
    const res = makeRes();

    await ctrl.addAttachments(req, res);

    expect(mediaUpload.uploadToImageKitWithRetry).not.toHaveBeenCalled();
    expect(mediaUpload.saveFileLocally).toHaveBeenCalledTimes(2);
    expect(Evidence.create).toHaveBeenCalledTimes(2);
    expect(Evidence.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ serviceId: 5, kind: 'photo', countryId: 3 })
    );
    expect(Evidence.create.mock.calls[1][0]).toEqual(
      expect.objectContaining({ serviceId: 5, kind: 'other', countryId: 3 })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 503 when ImageKit is disabled and local fallback is not allowed', async () => {
    Service.findByPk.mockResolvedValue({ id: 5, clientId: 1, countryId: null, regionId: null });
    mediaUpload.isImageKitEnabled.mockReturnValue(false);
    mediaUpload.resolveLocalFallbackPolicy.mockReturnValue({ allowLocalFallback: false });

    const req = {
      params: { id: '5' },
      user: { id: 1 },
      files: { photo: [{ originalname: 'p.jpg', mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('x') }] },
    };
    const res = makeRes();

    await ctrl.addAttachments(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(Evidence.create).not.toHaveBeenCalled();
  });
});
