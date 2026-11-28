import { api } from '../../../lib/apiClient.js';
import { ENGAGEMENT as CFG, HOME_FEATURES, HOME_FEATURE_KEYS, BUSINESS_DETAIL } from '../../../config/features.js';
import { applyEvent, mergeAdd, mergeLatest } from './scoring.js';

/**
 * Which Home features this person uses, for the personalised shortcut order.
 *
 * - Signed out: scores live in localStorage only.
 * - Signed in: scores are cached per user in localStorage (so each account has
 *   its own) and saved to the account (PATCH /users/me/engagement) a few
 *   seconds after a change. Signing in adds the signed-out scores to the
 *   account once (the record's id is sent as mergeId, so a retry never counts
 *   it twice) and then clears them.
 *
 * Only feature keys, decayed scores, times and an opaque session id are kept.
 */
const STORE = {
  anon: 'mt.engagement.anon',
  user: (id) => `mt.engagement.user.${id}`,
  session: 'mt.engagement.session',
  order: (owner) => `mt.homeOrder.${owner}`,
};

function read(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: scores just are not remembered */
  }
}
function drop(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const randomId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/* ----------------------------- sessions ----------------------------- */

/** The current usage session; a new one starts after CFG.sessionIdleMs without use. */
export function currentSession(now = Date.now()) {
  const saved = read(STORE.session);
  const session = !saved || now - saved.lastActive > CFG.sessionIdleMs ? { id: randomId(), lastActive: now } : { ...saved, lastActive: now };
  write(STORE.session, session);
  return session;
}

/* ----------------------------- state ----------------------------- */

let snapshot = { owner: null, ready: false, features: {} };
const listeners = new Set();
function emit(next) {
  snapshot = next;
  listeners.forEach((l) => l());
}
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getSnapshot = () => snapshot;

let ownerToken = 0;
let syncTimer = null;
let version = 0;
const lastOpen = new Map();
const seenActions = new Set();
let listingContext = null;

const userIdOf = (owner) => (owner?.startsWith('u:') ? owner.slice(2) : null);

function persist(features) {
  version += 1;
  const userId = userIdOf(snapshot.owner);
  if (userId) {
    write(STORE.user(userId), { features, dirty: true });
    scheduleSync();
  } else {
    write(STORE.anon, { id: read(STORE.anon)?.id ?? randomId(), features });
  }
}

/* ----------------------------- syncing ----------------------------- */

async function syncNow() {
  clearTimeout(syncTimer);
  syncTimer = null;
  const userId = userIdOf(snapshot.owner);
  if (!userId || !snapshot.ready) return;
  const cache = read(STORE.user(userId));
  if (!cache?.dirty) return;
  const sent = version;
  try {
    await api.patch('/users/me/engagement', { features: cache.features });
    if (sent === version) write(STORE.user(userId), { features: cache.features, dirty: false });
  } catch {
    /* offline or signed out: stays dirty and is sent next time */
  }
}
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, CFG.syncDelayMs);
}
/** Send pending changes now (the app is being hidden or the account changes). */
export function flushEngagement() {
  if (syncTimer) syncNow();
}

/** Switch to the signed-in user's scores (userId) or the signed-out ones (null). */
export async function setEngagementOwner(userId) {
  const owner = userId ? `u:${userId}` : 'anon';
  if (snapshot.owner === owner) return;
  flushEngagement();
  const token = ++ownerToken;
  listingContext = null;
  if (!userId) {
    emit({ owner, ready: true, features: read(STORE.anon)?.features ?? {} });
    return;
  }
  emit({ owner, ready: false, features: read(STORE.user(userId))?.features ?? {} });
  try {
    const res = await api.get('/users/me/engagement');
    if (token !== ownerToken) return;
    // snapshot.features also holds anything used while this request was running.
    let features = mergeLatest(res.data?.features, snapshot.features);
    let dirty = Boolean(read(STORE.user(userId))?.dirty);
    const anon = read(STORE.anon);
    if (anon?.id && Object.keys(anon.features ?? {}).length) {
      const combined = mergeAdd(features, anon.features, Date.now(), CFG);
      const saved = await api.patch('/users/me/engagement', { features: combined, mergeId: anon.id });
      if (token !== ownerToken) return;
      features = saved.data?.applied ? combined : mergeLatest(saved.data?.features, features);
      dirty = !saved.data?.applied && dirty;
      drop(STORE.anon);
    }
    write(STORE.user(userId), { features, dirty });
    emit({ owner, ready: true, features });
    if (dirty) scheduleSync();
  } catch {
    if (token === ownerToken) emit({ ...snapshot, ready: true }); // use the cached scores
  }
}

/* ----------------------------- tracking ----------------------------- */

/**
 * Count one meaningful use of a feature: 'open' (its main list) or 'action'
 * (an item in it, a like, a comment). Opening the same feature again within
 * CFG.repeatOpenMs, and the same action twice in a session, are ignored.
 * Returns whether it counted.
 */
export function trackFeature(feature, type = 'open', ref = '') {
  if (!HOME_FEATURE_KEYS.has(feature) || !snapshot.owner) return false;
  const now = Date.now();
  const session = currentSession(now);
  if (type === 'open') {
    const last = lastOpen.get(feature);
    if (last && now - last < CFG.repeatOpenMs) return false;
    lastOpen.set(feature, now);
  } else {
    const key = `${session.id}|${feature}|${ref}`;
    if (seenActions.has(key)) return false;
    seenActions.add(key);
  }
  const features = applyEvent(snapshot.features, { feature, type, sessionId: session.id, now }, CFG);
  emit({ ...snapshot, features });
  persist(features);
  return true;
}

function listingFeature(pathname, params, categories) {
  if (pathname === '/businesses') {
    const categoryId = params.get('categoryId');
    if (categoryId) {
      const c = categories?.find((x) => x.id === categoryId && !x.parentId);
      return (c && HOME_FEATURES.find((f) => f.categorySlug === c.slug)?.key) || null;
    }
    return params.get('kind') === 'service' ? 'services' : 'businesses';
  }
  return HOME_FEATURES.find((f) => f.listing?.path === pathname && !f.listing.params)?.key ?? null;
}

/**
 * Count a page visit: a feature's main list is an 'open'; an item page is an
 * 'action' (a business counts for the list it was opened from, e.g. Food).
 */
export function trackLocation(pathname, search = '', categories = null) {
  const listing = listingFeature(pathname, new URLSearchParams(search), categories);
  if (listing) {
    listingContext = listing;
    return trackFeature(listing, 'open');
  }
  const detail = HOME_FEATURES.find((f) => f.detail?.test(pathname));
  if (detail) return trackFeature(detail.key, 'action', pathname);
  if (BUSINESS_DETAIL.test(pathname)) {
    const from = HOME_FEATURES.find((f) => f.key === listingContext && f.businessDetail);
    return trackFeature(from?.key ?? 'businesses', 'action', pathname);
  }
  return false;
}

/* ----------------------------- Home order ----------------------------- */

/** Keep the registry's keys only, and add any new feature at the end. */
export function completeOrder(keys) {
  const valid = (keys ?? []).filter((k) => HOME_FEATURE_KEYS.has(k));
  return [...new Set([...valid, ...HOME_FEATURES.map((f) => f.key)])];
}

/** The order saved for this session, if it is still fresh. */
export function savedOrder(owner, now = Date.now()) {
  const saved = read(STORE.order(owner));
  const sessionId = currentSession(now).id;
  if (!saved || saved.sessionId !== sessionId || now - saved.at > CFG.reorderAfterMs) return null;
  return completeOrder(saved.keys);
}

/**
 * Home's shortcut order for this session: recalculated only in a new session
 * or after CFG.reorderAfterMs, never while someone is using the grid.
 */
export function sessionOrder(owner, rank, now = Date.now()) {
  const kept = savedOrder(owner, now);
  if (kept) return kept;
  const keys = completeOrder(rank());
  write(STORE.order(owner), { sessionId: currentSession(now).id, at: now, keys });
  return keys;
}

/** Tests only: forget everything held in memory. */
export function resetEngagementForTests() {
  clearTimeout(syncTimer);
  syncTimer = null;
  ownerToken += 1;
  version = 0;
  lastOpen.clear();
  seenActions.clear();
  listingContext = null;
  snapshot = { owner: null, ready: false, features: {} };
}
