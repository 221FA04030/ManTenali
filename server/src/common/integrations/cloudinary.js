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

/** Base URL every delivered image from our account starts with. */
export function deliveryPrefix(cloudName) {
  return `https://res.cloudinary.com/${cloudName}/image/upload/`;
}
