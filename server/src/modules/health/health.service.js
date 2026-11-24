import { pingDb } from '../../config/db.js';

const startedAt = Date.now();

/** Liveness plus database connectivity. Never exposes connection details. */
export async function getHealth() {
  const dbUp = await pingDb();
  return {
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'up' : 'down',
    uptimeS: Math.round((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
  };
}
