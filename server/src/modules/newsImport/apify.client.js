import { getEnv } from '../../config/env.js';

/**
 * Minimal Apify REST client for the Instagram posts scraper. Server-only:
 * the APIFY_TOKEN goes in the Authorization header and nowhere else (never in
 * a URL, a log line or an error message).
 */
const API = 'https://api.apify.com/v2';
export const INSTAGRAM_ACTOR = 'sones~instagram-posts-scraper-lowcost';

/** How long the actor may run, and how long we wait for its answer (a little longer). */
export const ACTOR_TIMEOUT_SECS = 120;
const FETCH_TIMEOUT_MS = (ACTOR_TIMEOUT_SECS + 30) * 1000;
const DATASET_TIMEOUT_MS = 30_000;

/** A failure talking to Apify, with a message that is safe to show an admin. */
export class ApifyError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'ApifyError';
    this.kind = kind; // not_configured | auth | payment | rate_limited | timeout | network | upstream | bad_response
  }
}

async function request(path, { method = 'GET', body, timeoutMs }) {
  const token = getEnv().APIFY_TOKEN;
  if (!token) throw new ApifyError('not_configured', 'Fetch News is not set up on the server (APIFY_TOKEN is missing).');
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new ApifyError('timeout', 'Apify did not answer in time. Try again in a few minutes.');
    }
    throw new ApifyError('network', 'Could not reach Apify. Check the server connection and try again.');
  }
  if (res.status === 401 || res.status === 403) throw new ApifyError('auth', 'Apify rejected the server token. Check APIFY_TOKEN.');
  if (res.status === 402) throw new ApifyError('payment', 'The Apify account has run out of credit.');
  if (res.status === 429) throw new ApifyError('rate_limited', 'Apify is limiting requests right now. Try again in a few minutes.');
  if (res.status === 408) throw new ApifyError('timeout', 'The Instagram fetch took too long on Apify. Try again with fewer posts.');
  if (!res.ok) throw new ApifyError('upstream', `Apify returned an error (HTTP ${res.status}). Try again later.`);
  try {
    return await res.json();
  } catch {
    throw new ApifyError('bad_response', 'Apify sent a reply that could not be read.');
  }
}

const asItems = (data) => {
  if (!Array.isArray(data)) throw new ApifyError('bad_response', 'Apify sent an unexpected reply (no list of posts).');
  return data;
};

/** Run the scraper for one profile and return its newest posts (dataset items). */
export async function fetchRecentPosts({ username, limit }) {
  const data = await request(`/acts/${INSTAGRAM_ACTOR}/run-sync-get-dataset-items?timeout=${ACTOR_TIMEOUT_SECS}&clean=true&format=json`, {
    method: 'POST',
    body: { usernames: [username], postsPerProfile: limit },
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  return asItems(data);
}

/** Items of a finished run's dataset (the scheduled-task webhook sends its id). */
export async function fetchDatasetItems(datasetId, limit) {
  const data = await request(`/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=${limit}`, {
    timeoutMs: DATASET_TIMEOUT_MS,
  });
  return asItems(data);
}
