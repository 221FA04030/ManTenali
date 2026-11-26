/**
 * Error reporting (spec section 13: Sentry). Thin wrapper so the rest of the
 * code never imports the SDK: off unless SENTRY_DSN is set, and the SDK is only
 * loaded when it is. Only unexpected (500) errors are sent, with the request id
 * and route - no cookies, headers, bodies, query strings or user details.
 */
let client = null;

export async function initErrorReporting(env, logger) {
  if (!env.SENTRY_DSN) return false;
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
  client = Sentry;
  logger?.info('error reporting enabled');
  return true;
}

/** Keep only what is needed to find the bug: method, path (no query string) and request id. */
export function scrubEvent(event) {
  if (event.request) {
    const path = String(event.request.url ?? '').split('?')[0];
    event.request = { method: event.request.method, url: path };
  }
  delete event.user;
  if (event.breadcrumbs) event.breadcrumbs = [];
  return event;
}

export function reportError(err, { requestId, method, route } = {}) {
  if (!client) return;
  client.withScope((scope) => {
    if (requestId) scope.setTag('requestId', requestId);
    if (method && route) scope.setTag('route', `${method} ${route}`);
    client.captureException(err);
  });
}

/** Test hook. */
export function _setClientForTests(fake) {
  client = fake;
}
