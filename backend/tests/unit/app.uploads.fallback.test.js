'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const express = require('express');

const ROUTE_MODULES = [
  'auth.routes',
  'property.routes',
  'user.routes',
  'service.routes',
  'task.routes',
  'evidence.routes',
  'transaction.routes',
  'notification.routes',
  'activity.routes',
  'dashboard.routes',
  'country.routes',
  'region.routes',
  'franchise.routes',
  'project.routes',
  'projectPhase.routes',
  'projectDocument.routes',
  'category.routes',
  'product.routes',
  'order.routes',
  'orderItem.routes',
  'provider.routes',
  'tradeCategory.routes',
  'missionRequest.routes',
];

function mountMockRouters() {
  ROUTE_MODULES.forEach((name) => {
    jest.doMock(`../../src/routes/${name}`, () => express.Router());
  });
}

describe('app uploads legacy fallback', () => {
  const envBackup = {
    NODE_ENV: process.env.NODE_ENV,
    UPLOADS_ROOT: process.env.UPLOADS_ROOT,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
  };

  let customUploadsRoot;
  let legacyFilePath;
  let legacyFileName;

  beforeEach(() => {
    jest.resetModules();

    customUploadsRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'teranga-uploads-custom-')
    );

    const backendRoot = path.resolve(__dirname, '..', '..');
    const legacyUploadsRoot = path.join(backendRoot, 'uploads');
    fs.mkdirSync(legacyUploadsRoot, { recursive: true });

    legacyFileName = `legacy_fallback_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}.txt`;
    legacyFilePath = path.join(legacyUploadsRoot, legacyFileName);
    fs.writeFileSync(legacyFilePath, 'legacy-fallback-ok', 'utf8');

    process.env.NODE_ENV = 'test';
    process.env.UPLOADS_ROOT = customUploadsRoot;
    delete process.env.UPLOADS_DIR;

    jest.doMock('../../src/utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    jest.doMock('../../src/middleware/requestContext.middleware', () => (_req, _res, next) => next());
    jest.doMock('../../src/middleware/securityHeaders.middleware', () => (_req, _res, next) => next());
    jest.doMock('../../src/middleware/auth.middleware', () => (_req, _res, next) => next());
    jest.doMock('../../src/middleware/roles.middleware', () => ({
      requireRoles: () => (_req, _res, next) => next(),
    }));
    jest.doMock('../../src/middleware/metrics.middleware', () => ({
      metricsMiddleware: (_req, _res, next) => next(),
      metricsHandler: (_req, res) => res.json({ ok: true }),
      frontendErrorHandler: (_req, res) => res.status(202).json({ ok: true }),
    }));

    mountMockRouters();
  });

  afterEach(() => {
    try {
      if (legacyFilePath && fs.existsSync(legacyFilePath)) {
        fs.unlinkSync(legacyFilePath);
      }
    } catch (_err) {
      // no-op
    }

    try {
      if (customUploadsRoot && fs.existsSync(customUploadsRoot)) {
        fs.rmSync(customUploadsRoot, { recursive: true, force: true });
      }
    } catch (_err) {
      // no-op
    }

    process.env.NODE_ENV = envBackup.NODE_ENV;
    process.env.UPLOADS_ROOT = envBackup.UPLOADS_ROOT;
    process.env.UPLOADS_DIR = envBackup.UPLOADS_DIR;
  });

  test('serves legacy uploads file when UPLOADS_ROOT points to another directory', async () => {
    const app = require('../../src/app');

    const res = await request(app).get(`/uploads/${legacyFileName}`).expect(200);

    expect(res.text).toBe('legacy-fallback-ok');
  });
});

