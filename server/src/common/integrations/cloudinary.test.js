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

describe('private file helpers (event evidence)', () => {
  it('getResource uses Basic auth, asks for page counts and maps 404 to null', async () => {
    const { getResource } = await import('./cloudinary.js');
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ public_id: 'mana-tenali/evidence/u_1/f', resource_type: 'image', type: 'private', format: 'pdf', bytes: 1234, pages: 3 }), { status: 200 }),
    );
    const r = await getResource({ publicId: 'mana-tenali/evidence/u_1/f' }, { fetchImpl });
    expect(r).toMatchObject({ type: 'private', format: 'pdf', bytes: 1234, pages: 3 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/test-cloud/resources/image/private/mana-tenali/evidence/u_1/f?pages=true');
    expect(init.headers.Authorization).toMatch(/^Basic /);
    const missing = await getResource({ publicId: 'x' }, { fetchImpl: vi.fn().mockResolvedValue(new Response('', { status: 404 })) });
    expect(missing).toBeNull();
  });

  it('destroyAsset sends a signed request for the private file', async () => {
    const { destroyAsset } = await import('./cloudinary.js');
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: 'ok' }), { status: 200 }));
    expect(await destroyAsset({ publicId: 'mana-tenali/evidence/u_1/f' }, { fetchImpl })).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/test-cloud/image/destroy');
    const form = new URLSearchParams(init.body.toString());
    expect(form.get('type')).toBe('private');
    expect(form.get('signature')).toMatch(/^[a-f0-9]{40}$/);
    expect(init.body.toString()).not.toContain('test-only-cloudinary-secret');
  });

  it('privateDownloadUrl is signed, expires, and never contains the secret', async () => {
    const { privateDownloadUrl, signParams } = await import('./cloudinary.js');
    const { url, expiresAt } = privateDownloadUrl({ publicId: 'a/b', format: 'pdf', attachment: true, expiresInSeconds: 300, now: 1_700_000_000_000 });
    const q = new URL(url).searchParams;
    expect(q.get('type')).toBe('private');
    expect(q.get('expires_at')).toBe('1700000300');
    expect(q.get('attachment')).toBe('true');
    const { signature, api_key: _k, ...signed } = Object.fromEntries(q);
    expect(signature).toBe(signParams(signed, 'test-only-cloudinary-secret'));
    expect(url).not.toContain('test-only-cloudinary-secret');
    expect(expiresAt.toISOString()).toBe('2023-11-14T22:18:20.000Z');
  });
});
