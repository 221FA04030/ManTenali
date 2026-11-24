import { describe, it, expect, afterEach, vi } from 'vitest';
import { missingCloudinaryVars, pingCloudinary, getCloudinaryConfig } from './cloudinary.js';
import { resetEnvCache } from '../../config/env.js';

const VARS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

describe('cloudinary configuration', () => {
  afterEach(() => {
    resetEnvCache();
    vi.restoreAllMocks();
  });

  it('reports the exact missing variable names (never values)', () => {
    expect(missingCloudinaryVars({})).toEqual(VARS);
    expect(missingCloudinaryVars({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '1' })).toEqual(['CLOUDINARY_API_SECRET']);
    expect(missingCloudinaryVars({ CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '1', CLOUDINARY_API_SECRET: 's' })).toEqual([]);
  });

  it('treats a partial configuration as not configured', () => {
    const saved = process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_KEY;
    resetEnvCache();
    try {
      expect(getCloudinaryConfig()).toBeNull();
    } finally {
      process.env.CLOUDINARY_API_KEY = saved;
    }
  });

  it('ping uses Basic auth and reports only the status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 }));
    const res = await pingCloudinary({ fetchImpl });
    expect(res).toEqual({ ok: true, status: 200 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/test-cloud/ping');
    expect(init.headers.Authorization).toMatch(/^Basic /);

    const denied = await pingCloudinary({ fetchImpl: vi.fn().mockResolvedValue(new Response('', { status: 401 })) });
    expect(denied).toEqual({ ok: false, status: 401 });
    const offline = await pingCloudinary({ fetchImpl: vi.fn().mockRejectedValue(new Error('offline')) });
    expect(offline).toEqual({ ok: false, status: 'network-error' });
  });
});
