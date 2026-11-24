import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { buildTestApp, connectTestDb, disconnectTestDb, TEST_ORIGIN } from './tests/helpers.js';
import { validate } from './common/middleware/validate.js';
import { errorHandler } from './common/middleware/errorHandler.js';
import { requestId } from './common/middleware/requestId.js';
import { asyncHandler } from './common/utils/asyncHandler.js';

describe('app foundation', () => {
  let app;
  beforeAll(async () => {
    await connectTestDb();
    app = buildTestApp();
  });
  afterAll(disconnectTestDb);

  it('GET /api/v1/health reports ok with the db up', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'ok', db: 'up' });
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb/i);
  });

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns 404 in the standard envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });

  it('allows CORS only for allow-listed origins', async () => {
    const good = await request(app).get('/api/v1/health').set('Origin', TEST_ORIGIN);
    expect(good.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(good.headers['access-control-allow-credentials']).toBe('true');
    const bad = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects writes from a foreign origin with 403', async () => {
    const res = await request(app).post('/api/v1/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects cookie-bearing writes without Origin or Referer', async () => {
    const res = await request(app).post('/api/v1/health').set('Cookie', 'session=abc');
    expect(res.status).toBe(403);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Origin', TEST_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('shared middleware', () => {
  function miniApp(register) {
    const app = express();
    app.use(requestId);
    app.use(express.json());
    register(app);
    app.use(errorHandler);
    return app;
  }

  it('validate() rejects bad input and unknown fields with details', async () => {
    const app = miniApp((a) =>
      a.post(
        '/echo',
        validate({ body: z.strictObject({ name: z.string().min(2) }) }),
        (req, res) => res.json({ success: true, data: req.validated.body }),
      ),
    );
    const bad = await request(app).post('/echo').send({ name: 'x', role: 'admin' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect(bad.body.error.details.map((d) => d.field)).toContain('body.name');
    expect(bad.body.error.details.some((d) => /role/.test(d.message))).toBe(true);

    const good = await request(app).post('/echo').send({ name: 'Tenali' });
    expect(good.status).toBe(200);
    expect(good.body.data).toEqual({ name: 'Tenali' });
  });

  it('turns unexpected errors into a generic 500 without leaking internals', async () => {
    const app = miniApp((a) =>
      a.get(
        '/boom',
        asyncHandler(async () => {
          throw new Error('secret internal detail');
        }),
      ),
    );
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
    expect(res.body.error.details.requestId).toBe(res.headers['x-request-id']);
  });
});
