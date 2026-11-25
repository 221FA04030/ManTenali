import { createHash } from 'node:crypto';
import { getEnv } from '../../config/env.js';

/**
 * Thin Cloudinary wrapper (spec: third-party services behind one file).
 * The API secret never leaves the server: we only return a signature.
 */
export const CLOUDINARY_VARS = Object.freeze(['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']);

/** Names (never values) of the Cloudinary variables that are not set. */
export function missingCloudinaryVars(env = getEnv()) {
  return CLOUDINARY_VARS.filter((name) => !env[name]);
}

export function getCloudinaryConfig() {
  const env = getEnv();
  if (missingCloudinaryVars(env).length) return null;
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
}

/** Cloudinary request signature: sha1("k1=v1&k2=v2" sorted by key + secret). */
export function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${Array.isArray(params[k]) ? params[k].join(',') : params[k]}`)
    .join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export function uploadUrl(cloudName) {
  return `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
}

/**
 * Verify the credentials with Cloudinary's Admin API ping endpoint.
 * Returns { ok, status } only - never echoes credentials or response bodies.
 */
export async function pingCloudinary({ fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
  const config = getCloudinaryConfig();
  if (!config) return { ok: false, status: 'not-configured' };
  const auth = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64');
  try {
    const res = await fetchImpl(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/ping`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 'network-error' };
  }
}

/* ---------- private files (event evidence) ---------- */

const API_BASE = 'https://api.cloudinary.com/v1_1';

function requireConfigured() {
  const config = getCloudinaryConfig();
  if (!config) {
    const err = new Error('Cloudinary is not configured');
    err.code = 'CLOUDINARY_NOT_CONFIGURED';
    throw err;
  }
  return config;
}

/**
 * Look up an uploaded file through the Admin API (authoritative size, format,
 * page count, delivery type). Returns null when it doesn't exist.
 * Never logs or returns credentials.
 */
export async function getResource({ publicId, resourceType = 'image', type = 'private' }, { fetchImpl = fetch } = {}) {
  const { cloudName, apiKey, apiSecret } = requireConfigured();
  const path = `${API_BASE}/${encodeURIComponent(cloudName)}/resources/${resourceType}/${type}/${publicId
    .split('/')
    .map(encodeURIComponent)
    .join('/')}?pages=true`;
  const res = await fetchImpl(path, {
    headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cloudinary lookup failed (${res.status})`);
  const r = await res.json();
  return {
    publicId: r.public_id,
    resourceType: r.resource_type,
    type: r.type,
    format: r.format,
    bytes: r.bytes,
    width: r.width ?? null,
    height: r.height ?? null,
    pages: r.pages ?? null,
  };
}

/** Delete a file (best effort). Returns true when Cloudinary confirms. */
export async function destroyAsset({ publicId, resourceType = 'image', type = 'private' }, { fetchImpl = fetch } = {}) {
  const { cloudName, apiKey, apiSecret } = requireConfigured();
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000), type };
  const body = new URLSearchParams({ ...params, api_key: apiKey, signature: signParams(params, apiSecret) });
  const res = await fetchImpl(`${API_BASE}/${encodeURIComponent(cloudName)}/${resourceType}/destroy`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return false;
  const json = await res.json().catch(() => ({}));
  return json.result === 'ok' || json.result === 'not found';
}

/**
 * Time-limited link to a PRIVATE file (Cloudinary "private download URL").
 * `attachment: true` forces a download instead of displaying it.
 */
export function privateDownloadUrl({ publicId, format, resourceType = 'image', expiresInSeconds = 300, attachment = false, now = Date.now() }) {
  const { cloudName, apiKey, apiSecret } = requireConfigured();
  const timestamp = Math.floor(now / 1000);
  const params = {
    public_id: publicId,
    format,
    type: 'private',
    timestamp,
    expires_at: timestamp + expiresInSeconds,
    ...(attachment ? { attachment: 'true' } : {}),
  };
  const query = new URLSearchParams({ ...params, api_key: apiKey, signature: signParams(params, apiSecret) });
  return { url: `${API_BASE}/${encodeURIComponent(cloudName)}/${resourceType}/download?${query}`, expiresAt: new Date((timestamp + expiresInSeconds) * 1000) };
}

/** Base URL every delivered image from our account starts with. */
export function deliveryPrefix(cloudName) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/`;
}
