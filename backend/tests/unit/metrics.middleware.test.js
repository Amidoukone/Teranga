'use strict';

const express = require('express');
const request = require('supertest');

describe('metrics middleware profiler data', () => {
  let requestContext;
  let metricsMiddleware;
  let metricsHandler;
  let recordSqlQuery;

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.SLOW_REQUEST_THRESHOLD_MS = '1';

    jest.doMock('../../src/utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    requestContext = require('../../src/middleware/requestContext.middleware');
    ({ metricsMiddleware, metricsHandler } = require('../../src/middleware/metrics.middleware'));
    ({ recordSqlQuery } = require('../../src/utils/requestPerf'));
  });

  afterEach(() => {
    delete process.env.SLOW_REQUEST_THRESHOLD_MS;
  });

  test('captures db timings and exposes profiler summaries', async () => {
    const app = express();
    app.use(requestContext);
    app.use(metricsMiddleware);

    app.get('/api/profiled', (_req, res) => {
      recordSqlQuery('SELECT * FROM services WHERE id = 1', 42);
      recordSqlQuery('SELECT * FROM tasks WHERE service_id = 1', 18);
      res.json({ ok: true });
    });

    app.get(
      '/api/metrics',
      (req, _res, next) => {
        req.user = { role: 'admin' };
        next();
      },
      metricsHandler
    );

    await request(app).get('/api/profiled').expect(200);
    const metricsRes = await request(app).get('/api/metrics').expect(200);

    expect(metricsRes.body.totals.requests).toBeGreaterThanOrEqual(1);
    expect(metricsRes.body.dbDurationsMs.avg).toBeGreaterThanOrEqual(60);
    expect(metricsRes.body.appDurationsMs.avg).toBeGreaterThanOrEqual(0);
    expect(metricsRes.body.dbQueries.avgPerRequest).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(metricsRes.body.topSlowRoutes)).toBe(true);
    expect(metricsRes.body.topSlowRoutes[0].path).toBe('/api/profiled');
    expect(metricsRes.body.topSlowRoutes[0].avgDbQueryCount).toBeGreaterThanOrEqual(2);
    expect(metricsRes.body.topSlowRoutes[0].avgDbDurationMs).toBeGreaterThanOrEqual(60);
    expect(metricsRes.body.slowRequests[0].path).toBe('/api/profiled');
    expect(metricsRes.body.slowRequests[0].dbQueryCount).toBeGreaterThanOrEqual(2);
    expect(metricsRes.body.slowRequests[0].dbDurationMs).toBeGreaterThanOrEqual(60);
  });
});
