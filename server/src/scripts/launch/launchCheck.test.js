import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectTestDb, disconnectTestDb, clearTestDb } from '../../tests/helpers.js';
import { createUser, createCategory, createBusiness } from '../../tests/factories.js';
import { loadEnv } from '../../config/env.js';
import { launchReport } from './launchCheck.js';

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const byName = (report) => Object.fromEntries(report.checks.map((c) => [c.name, c]));
const prodEnv = (o = {}) =>
  loadEnv({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://placeholder.example.invalid/x',
    CLIENT_ORIGIN: 'https://app.example.invalid',
    JWT_SECRET: 'x'.repeat(40),
    TRUST_PROXY: '1',
    ...o,
  });

async function referenceData() {
  const main = await createCategory({ type: 'business', slug: 'food-dining' });
  await createCategory({ type: 'business', slug: 'restaurants', parentId: main._id });
  await createCategory({ type: 'event', slug: 'festivals' });
  await createCategory({ type: 'news', slug: 'civic' });
}

describe('launch readiness check (read-only)', () => {
  it('an empty database is not ready: no categories, no admin', async () => {
    const report = await launchReport(prodEnv());
    const c = byName(report);
    expect(report.ok).toBe(false);
    expect(c['reference categories']).toMatchObject({ ok: false, level: 'error' });
    expect(c['active admin account']).toMatchObject({ ok: false, detail: '0 active admin(s)' });
  });

  it('ready with reference data, an admin and no sample data; optional services are warnings only', async () => {
    await referenceData();
    await createUser({ role: 'admin' });
    await createBusiness({ name: 'Real shop' });
    const report = await launchReport(prodEnv());
    const c = byName(report);
    expect(report.ok).toBe(true);
    expect(c['no sample data']).toMatchObject({ ok: true, detail: 'none' });
    expect(c['proxy setting']).toMatchObject({ ok: true });
    expect(c['error reporting (Sentry)']).toMatchObject({ ok: false, level: 'warn', detail: 'SENTRY_DSN not set' });
  });

  it('sample data or a missing proxy setting blocks a production launch; locally sample data is only a warning', async () => {
    await referenceData();
    await createUser({ role: 'admin' });
    await createBusiness({ name: 'Sample shop', isSeed: true });
    const prod = byName(await launchReport(prodEnv({ TRUST_PROXY: '0' })));
    expect(prod['no sample data']).toMatchObject({ ok: false, level: 'error', detail: 'businesses 1' });
    expect(prod['proxy setting']).toMatchObject({ ok: false, level: 'error' });
    const local = await launchReport(loadEnv({ ...process.env }));
    expect(byName(local)['no sample data']).toMatchObject({ ok: false, level: 'warn' });
    expect(local.ok).toBe(true);
  });

  it('never includes configuration values in its output', async () => {
    const report = await launchReport(prodEnv({ SENTRY_DSN: 'https://secretkey@o1.ingest.sentry.io/1', GOOGLE_CLIENT_ID: 'my-client-id' }));
    const text = JSON.stringify(report);
    expect(text).not.toMatch(/secretkey|my-client-id|placeholder\.example/);
  });
});
