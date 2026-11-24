import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError, buildUrl, setUnauthorizedHandler, errorMessageKey } from './apiClient.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.restoreAllMocks();
  setUnauthorizedHandler(null);
});

describe('apiClient', () => {
  it('builds URLs and skips empty query values', () => {
    expect(buildUrl('/businesses', { area: 'Bose Road', page: 2, kind: '', x: undefined })).toBe(
      '/api/v1/businesses?area=Bose+Road&page=2',
    );
  });

  it('returns data and meta and always sends cookies', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json({ success: true, data: [1], meta: { page: 1, total: 1 } }));
    const res = await api.get('/things', { query: { page: 1 } });
    expect(res).toEqual({ data: [1], meta: { page: 1, total: 1 } });
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('maps the error envelope to ApiError with field errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'bad', details: [{ field: 'body.email', message: 'Invalid email' }] },
        },
        400,
      ),
    );
    const err = await api.post('/auth/register', { email: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.fieldErrors).toEqual({ email: 'Invalid email' });
    expect(errorMessageKey(err)).toBe('errors.VALIDATION_ERROR');
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await api.get('/health').catch((e) => e);
    expect(err.code).toBe('NETWORK_ERROR');
    expect(errorMessageKey({ code: 'WHATEVER' })).toBe('errors.INTERNAL_ERROR');
  });

  it('calls the unauthorized handler on 401', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'no' } }, 401),
    );
    await api.get('/favorites').catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
