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
    delete process.env.METRICS_TOKEN;
  });

  test('metricsHandler accepts the exact token and rejects a wrong or missing one', async () => {
    process.env.METRICS_TOKEN = 'a-very-secret-metrics-token';
    const app = express();
    app.get('/api/metrics', (req, res, next) => { req.user = { role: 'client' }; next(); }, metricsHandler);

    const ok = await request(app).get('/api/metrics').set('x-metrics-token', 'a-very-secret-metrics-token');
    expect(ok.status).toBe(200);

    const wrong = await request(app).get('/api/metrics').set('x-metrics-token', 'a-very-secret-metrics-tokeN');
    expect(wrong.status).toBe(403);

    const differentLength = await request(app).get('/api/metrics').set('x-metrics-token', 'short');
    expect(differentLength.status).toBe(403);

    const missing = await request(app).get('/api/metrics');
    expect(missing.status).toBe(403);
  });

  test('captures db timings and exposes profiler summaries', async () => {
    const app = express();
    app.use(requestContext);
    app.use(metricsMiddleware);

    app.get('/api/profiled', async (_req, res) => {
      recordSqlQuery('SELECT * FROM services WHERE id = 1', 42);
      recordSqlQuery('SELECT * FROM tasks WHERE service_id = 1', 18);
      // Le seuil du test est de 1 ms. Sans délai explicite, un runner CI rapide peut terminer
      // la requête en moins de 1 ms et ne créer aucune entrée `slowRequests`, ce qui rendait
      // l'assertion dépendante des performances de la machine plutôt que du comportement testé.
      await new Promise((resolve) => setTimeout(resolve, 5));
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
