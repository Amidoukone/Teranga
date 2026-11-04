'use strict';

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
  'serviceCatalog.routes',
  'operations.routes',
  'clientRequests.routes',
  'missionRequest.routes',
  'mission.routes',
  'savedLocation.routes',
  'missionPricingRule.routes',
  'propertyListing.routes',
];

function mountMockRouters() {
  ROUTE_MODULES.forEach((name) => {
    jest.doMock(`../../src/routes/${name}`, () => express.Router());
  });
}

function setUpMocks() {
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
}

describe('app CORS posture', () => {
  const envBackup = {
    NODE_ENV: process.env.NODE_ENV,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    FRONTEND_URL: process.env.FRONTEND_URL,
    CLIENT_URL: process.env.CLIENT_URL,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN,
  };

  afterEach(() => {
    Object.entries(envBackup).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  function freshAppWithEnv(env) {
    jest.resetModules();
    delete process.env.CORS_ORIGINS;
    delete process.env.FRONTEND_URL;
    delete process.env.CLIENT_URL;
    delete process.env.CLIENT_ORIGIN;
    Object.entries(env).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    setUpMocks();
    return require('../../src/app');
  }

  test('an unrecognized NODE_ENV never reflects an arbitrary origin back (fails closed, not open)', async () => {
    const app = freshAppWithEnv({ NODE_ENV: 'Production' });
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  test('an unset NODE_ENV without any configured origin keeps the permissive local-dev behavior', async () => {
    const app = freshAppWithEnv({ NODE_ENV: undefined });
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('a real production NODE_ENV with configured origins rejects an unlisted origin', async () => {
    const app = freshAppWithEnv({ NODE_ENV: 'production', CORS_ORIGINS: 'https://teranga.example' });
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
});
