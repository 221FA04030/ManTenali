import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { scrubEvent, reportError, _setClientForTests } from './sentry.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AppError } from '../errors/index.js';

afterEach(() => _setClientForTests(null));

describe('error reporting (Sentry wrapper)', () => {
  it('scrubs events down to method, path and tags: no query string, cookies, headers, body or user', () => {
    const event = scrubEvent({
      request: { method: 'GET', url: 'https://api.example.in/api/v1/search?q=private', cookies: { mt_session: 'x' }, headers: { cookie: 'x' }, data: '{"password":"x"}' },
      user: { email: 'a@b.c', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'x' }],
      tags: { requestId: 'r1' },
    });
    expect(event).toEqual({ request: { method: 'GET', url: 'https://api.example.in/api/v1/search' }, breadcrumbs: [], tags: { requestId: 'r1' } });
  });

  it('is a no-op until enabled; then only unexpected (500) errors are reported, with the request id', async () => {
    reportError(new Error('nothing happens'));
    const captured = [];
    const tags = {};
    _setClientForTests({
      withScope: (fn) => fn({ setTag: (k, v) => (tags[k] = v) }),
      captureException: (err) => captured.push(err.message),
    });
    const app = express();
    app.use((req, _res, next) => {
      req.id = 'req-123';
      next();
    });
    app.get('/boom', () => {
      throw new Error('database exploded');
    });
    app.get('/missing', () => {
      throw AppError.notFound('Nope');
    });
    app.use(errorHandler);
    const boom = await request(app).get('/boom');
    expect(boom.status).toBe(500);
    expect(boom.body.error).toMatchObject({ code: 'INTERNAL_ERROR', details: { requestId: 'req-123' } });
    expect((await request(app).get('/missing')).status).toBe(404);
    expect(captured).toEqual(['database exploded']); // the 404 is not reported
    expect(tags).toEqual({ requestId: 'req-123', route: 'GET /boom' });
  });
});
