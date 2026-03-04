'use strict';

jest.mock('../../models', () => ({
  Transaction: {
    findByPk: jest.fn(),
  },
  User: {},
  Service: {},
  Task: {},
  Order: {},
  Project: {},
}));

jest.mock('../../src/services/transaction.service', () => ({
  toSafeInt: jest.fn((v) => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }),
  toTrimOrNull: jest.fn((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }),
  getPagination: jest.fn(() => ({ limit: 25, offset: 0, page: 1 })),
  buildWhereWithACL: jest.fn(() => ({})),
  canAccessTransaction: jest.fn(async () => true),
  COMMON_INCLUDE: [],
  isGlobalAdmin: jest.fn(() => false),
}));

jest.mock('../../src/helpers/teranga-imagekit', () => ({
  upload: jest.fn(),
  deleteFile: jest.fn(),
}));

jest.mock('../../src/utils/geoScope', () => ({
  applyGeoScopeForModel: jest.fn((where) => where),
  getCountryIdByIso: jest.fn(async () => null),
  getUserGeoScope: jest.fn(() => ({ countryId: null, regionId: null })),
}));

jest.mock('../../src/utils/uploadsRoot', () => ({
  resolveUploadsRoot: jest.fn(() => process.cwd()),
}));

jest.mock('../../src/utils/mediaStorageDiagnostics', () => ({
  buildMediaStorageDiagnostics: jest.fn(() => ({})),
  isImageKitConfigured: jest.fn(() => false),
}));

jest.mock('../../src/utils/mediaStoragePolicy', () => ({
  evaluateLocalMediaFallback: jest.fn(() => ({ allowLocalFallback: true })),
}));

jest.mock('../../src/utils/labels', () => ({
  TRANSACTION_TYPES: {},
  TRANSACTION_STATUSES: {},
  CURRENCY_LABELS: {},
  getLabel: jest.fn((key) => key),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { Transaction } = require('../../models');
const { isGlobalAdmin } = require('../../src/services/transaction.service');
const controller = require('../../src/controllers/transaction.controller');

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('transaction.controller remove global admin guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 403 when requester is not global admin', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Transaction.findByPk.mockResolvedValue({
      id: 11,
      proofFile: null,
      destroy,
    });
    isGlobalAdmin.mockReturnValue(false);

    const req = {
      user: { id: 7, role: 'admin', countryId: 1, regionId: null },
      params: { id: '11' },
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('administrateur global'),
      })
    );
    expect(destroy).not.toHaveBeenCalled();
  });

  test('deletes transaction when requester is global admin', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    Transaction.findByPk.mockResolvedValue({
      id: 11,
      proofFile: null,
      destroy,
    });
    isGlobalAdmin.mockReturnValue(true);

    const req = {
      user: { id: 1, role: 'admin', countryId: null, regionId: null },
      params: { id: '11' },
    };
    const res = makeRes();

    await controller.remove(req, res);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Transaction supprim'),
      })
    );
  });
});
