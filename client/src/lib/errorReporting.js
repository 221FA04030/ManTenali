/**
 * Browser error reporting (spec section 13: VITE_SENTRY_DSN). Off unless the
 * DSN is set; the SDK is then loaded in its own chunk, so nobody downloads it
 * otherwise. No personal data: no user, no IP, no query strings, no breadcrumbs
 * (which could contain search words or typed text), no session replay.
 */
let sentry = null;

export function scrubEvent(event) {
  if (event.request?.url) event.request = { url: String(event.request.url).split('?')[0] };
  delete event.user;
  event.breadcrumbs = [];
  return event;
}

export async function initErrorReporting(dsn = import.meta.env.VITE_SENTRY_DSN) {
  if (!dsn) return false;
  const Sentry = await import('@sentry/react');
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: () => null,
  });
  sentry = Sentry;
  return true;
}

/** Used by the error boundary; a no-op until reporting is enabled. */
export function reportError(error, extra) {
  sentry?.captureException(error, extra ? { extra } : undefined);
}
