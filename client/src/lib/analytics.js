import { useEffect, useRef } from 'react';
import { buildUrl } from './apiClient.js';

/**
 * Anonymous activity events (FR-ANA-1): view, contact_click, offer_view, share,
 * search. Only a random device id is sent - no account, query text or location
 * (D9.6). Fire-and-forget: failures are ignored and never affect the page.
 */
const SID_KEY = 'mt.sid';
let enabled = import.meta.env.MODE !== 'test';

/** Tests turn tracking on explicitly; it is off by default under Vitest. */
export function setAnalyticsEnabled(on) {
  enabled = on;
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** The anonymous device id (random, kept in this browser only). */
export function sessionId() {
  try {
    let sid = window.localStorage.getItem(SID_KEY);
    if (!sid) {
      sid = randomId();
      window.localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return randomId(); // private mode: a fresh id per page load
  }
}

export function track(type, targetType, targetId) {
  if (!enabled) return;
  const body = { type, sessionId: sessionId(), ...(targetType ? { targetType, targetId } : {}) };
  try {
    // keepalive: still delivered when the tap opens the dialler, WhatsApp or maps.
    fetch(buildUrl('/analytics/events'), {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}

/** Record one event per distinct target while the component is shown (e.g. a detail page view). */
export function useTrackOnce(type, targetType, targetId) {
  const sent = useRef(null);
  useEffect(() => {
    const key = `${type}:${targetType ?? ''}:${targetId ?? ''}`;
    if ((targetType && !targetId) || sent.current === key) return;
    sent.current = key;
    track(type, targetType, targetId);
  }, [type, targetType, targetId]);
}
