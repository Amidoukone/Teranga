'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'teranga_test_secret';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(async () => 'hashed-password'),
}));

jest.mock('../../models', () => ({
  User: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  Country: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  Region: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  },
  Franchise: {
    count: jest.fn(),
  },
  RecoveryCode: {
    update: jest.fn(),
    bulkCreate: jest.fn(),
  },
  RefreshToken: {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
  TokenBlacklist: {
    findOrCreate: jest.fn(),
  },
  PasswordResetToken: {
    update: jest.fn(),
    create: jest.fn(),
  },
  Sequelize: {
    Op: {},
    where: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
  },
}));

jest.mock('../../src/services/authCache.service', () => ({
  cacheRevokedToken: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const bcrypt = require('bcrypt');
const { User, RefreshToken } = require('../../models');
const controller = require('../../src/controllers/auth.controller');

function makeReq({
  body = {},
  headers = {},
  cookies = {},
  ip = '127.0.0.1',
} = {}) {
  return {
    body,
    headers,
    cookies,
    ip,
    get(name) {
      const lowered = String(name || '').toLowerCase();
      if (lowered === 'user-agent') return 'jest';
      return headers[lowered];
    },
  };
}

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    set: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('auth.controller session fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RefreshToken.create.mockResolvedValue({ id: 88 });
    User.findAll.mockReset();
  });

  test('login exposes refresh token when fallback header is requested', async () => {
    bcrypt.compare.mockResolvedValue(true);
    User.findOne.mockResolvedValue({
      id: 7,
      email: 'new.user@test.com',
      passwordHash: 'hashed-password',
      role: 'client',
      countryId: null,
      regionId: null,
      language: 'fr',
      firstName: 'New',
      lastName: 'User',
      update: jest.fn().mockResolvedValue(undefined),
    });

    const req = makeReq({
      body: { email: 'new.user@test.com', password: 'Password123!' },
      headers: { 'x-teranga-session-fallback': 'bearer' },
    });
    const res = makeRes();

    await controller.login(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({ id: 7 }),
      })
    );
    expect(res.cookie).toHaveBeenCalled();
  });

  test('login accepts a phone identifier', async () => {
    bcrypt.compare.mockResolvedValue(true);
    const update = jest.fn().mockResolvedValue(undefined);
    User.findAll.mockResolvedValue([
      {
        id: 8,
        email: null,
        phone: '+22370000000',
        passwordHash: 'hashed-password',
        role: 'client',
        countryId: null,
        regionId: null,
        language: 'fr',
        firstName: 'Phone',
        lastName: 'User',
        update,
      },
    ]);

    const req = makeReq({
      body: { identifier: '00223 70 00 00 00', password: 'Password123!' },
    });
    const res = makeRes();

    await controller.login(req, res);

    expect(User.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: '+22370000000' },
        limit: 2,
      })
    );
    expect(update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({
          id: 8,
          email: null,
          phone: '+22370000000',
        }),
      })
    );
  });

  test('refresh rotates body refresh token and returns a new fallback token', async () => {
    const revokePrevious = jest.fn().mockResolvedValue(undefined);
    RefreshToken.findOne.mockResolvedValue({
      userId: 9,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      update: revokePrevious,
    });
    RefreshToken.create.mockResolvedValue({ id: 123 });
    User.findByPk.mockResolvedValue({
      id: 9,
      role: 'client',
      countryId: null,
      regionId: null,
      language: 'fr',
    });

    const req = makeReq({
      body: { refreshToken: 'seed-refresh-token' },
    });
    const res = makeRes();

    await controller.refresh(req, res);

    expect(revokePrevious).toHaveBeenCalledWith(
      expect.objectContaining({
        replacedByTokenId: 123,
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        refreshToken: expect.any(String),
      })
    );
  });

  test('logout revokes refresh token provided in request body', async () => {
    const revokeStored = jest.fn().mockResolvedValue(undefined);
    RefreshToken.findOne.mockResolvedValue({
      revokedAt: null,
      update: revokeStored,
    });

    const req = makeReq({
      body: { refreshToken: 'body-refresh-token' },
    });
    const res = makeRes();

    await controller.logout(req, res);

    expect(RefreshToken.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: expect.any(String),
        }),
      })
    );
    expect(revokeStored).toHaveBeenCalledWith(
      expect.objectContaining({
        revokedAt: expect.any(Date),
        revokedByIp: '127.0.0.1',
      })
    );
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.any(String),
      })
    );
  });
});
