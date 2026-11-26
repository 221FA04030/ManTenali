import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs } from '../../tests/factories.js';
import { istStartOfDay, istToday } from '../../common/utils/dates.js';
import { ActivityEvent, RETENTION_DAYS } from './analytics.model.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const ID = '64d0de0000000000000000aa';
const SID = 'a1b2c3d4-e5f6-4711-8899-aabbccddeeff';
const post = (body, agent = request(app)) => agent.post('/api/v1/analytics/events').set('Origin', TEST_ORIGIN).send(body);

describe('POST /analytics/events (FR-ANA-1)', () => {
  it('records each activity type anonymously (202), from visitors and signed-in users alike', async () => {
    const ok = [
      { type: 'view', targetType: 'business', targetId: ID },
      { type: 'view', targetType: 'event', targetId: ID },
      { type: 'view', targetType: 'news', targetId: ID },
      { type: 'offer_view', targetType: 'offer', targetId: ID },
      { type: 'contact_click', targetType: 'business', targetId: ID },
      { type: 'share', targetType: 'offer', targetId: ID },
      { type: 'search' },
    ];
    for (const body of ok) expect((await post({ ...body, sessionId: SID })).status).toBe(202);
    const { agent } = await loginAs(app, 'user');
    expect((await post({ type: 'search', sessionId: SID }, agent)).body).toEqual({ success: true, data: { recorded: true } });

    const stored = await ActivityEvent.find().lean();
    expect(stored).toHaveLength(8);
    // Only these fields exist: no user id, IP address, query text or coordinates, even when signed in.
    for (const doc of stored) {
      expect(Object.keys(doc).filter((k) => !['_id', 'type', 'targetType', 'targetId', 'sessionId', 'createdAt'].includes(k))).toEqual([]);
    }
  });

  it('rejects targets that do not fit the type, bad ids, unknown fields and missing session ids', async () => {
    const bad = [
      { type: 'contact_click', targetType: 'event', targetId: ID },
      { type: 'offer_view', targetType: 'business', targetId: ID },
      { type: 'view', targetType: 'business' },
      { type: 'view', targetType: 'review', targetId: ID },
      { type: 'search', targetType: 'business', targetId: ID },
      { type: 'like', targetType: 'business', targetId: ID },
      { type: 'view', targetType: 'business', targetId: 'nope' },
    ];
    for (const body of bad) expect((await post({ ...body, sessionId: SID })).status).toBe(400);
    expect((await post({ type: 'search' })).status).toBe(400);
    expect((await post({ type: 'search', sessionId: 'short' })).status).toBe(400);
    expect((await post({ type: 'search', sessionId: SID, userId: ID })).status).toBe(400);
    expect((await post({ type: 'search', sessionId: SID, lat: 16.2 })).status).toBe(400);
    expect(await ActivityEvent.countDocuments()).toBe(0);
  });

  it(`events expire automatically after ${RETENTION_DAYS} days (TTL index)`, async () => {
    await ActivityEvent.init();
    const ttl = (await ActivityEvent.collection.indexes()).find((i) => i.expireAfterSeconds !== undefined);
    expect(ttl).toMatchObject({ key: { createdAt: 1 }, expireAfterSeconds: 180 * 86_400 });
  });
});

describe('GET /admin/analytics/summary', () => {
  it('admins get counts by type, per IST day, and distinct anonymous sessions (default: last 7 days)', async () => {
    const today = istToday();
    const at = (daysAgo, h = 12) => new Date(istStartOfDay(today).getTime() - daysAgo * 86_400_000 + h * 3_600_000);
    await ActivityEvent.insertMany([
      { type: 'view', targetType: 'business', targetId: ID, sessionId: 's-aaaaaaaa', createdAt: at(0) },
      { type: 'view', targetType: 'business', targetId: ID, sessionId: 's-bbbbbbbb', createdAt: at(0) },
      { type: 'contact_click', targetType: 'business', targetId: ID, sessionId: 's-aaaaaaaa', createdAt: at(1) },
      { type: 'search', sessionId: 's-aaaaaaaa', createdAt: at(6) },
      { type: 'search', sessionId: 's-cccccccc', createdAt: at(8) }, // outside the default 7 days
    ]);
    const { agent } = await loginAs(app, 'admin');
    const res = await agent.get('/api/v1/admin/analytics/summary');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ to: today, totals: { view: 2, contact_click: 1, search: 1, offer_view: 0, share: 0 }, sessions: 2 });
    expect(res.body.data.byDay).toHaveLength(7);
    expect(res.body.data.byDay.at(-1)).toMatchObject({ date: today, view: 2 });
    const wide = await agent.get('/api/v1/admin/analytics/summary').query({ from: res.body.data.byDay[0].date.replace(/\d\d$/, '01'), to: today });
    expect(wide.status).toBe(200);
    expect((await agent.get('/api/v1/admin/analytics/summary').query({ from: '2026-01-01', to: '2026-12-31' })).status).toBe(400); // > 92 days
    expect((await agent.get('/api/v1/admin/analytics/summary').query({ from: '2026-11-20', to: '2026-11-10' })).status).toBe(400);
  });

  it('launch metrics: weekly devices, search -> contact, event views and shares, 7-day retention, freshness', async () => {
    const { createBusiness } = await import('../../tests/factories.js');
    const DAY = 86_400_000;
    const now = Date.now();
    const ago = (d, extraMs = 0) => new Date(now - d * DAY + extraMs);
    await ActivityEvent.insertMany([
      // device A: searched, then called -> converted; first seen 20 days ago and back today -> returned
      { type: 'view', targetType: 'business', targetId: ID, sessionId: 'dev-aaaaaaa', createdAt: ago(20) },
      { type: 'search', sessionId: 'dev-aaaaaaa', createdAt: ago(1) },
      { type: 'contact_click', targetType: 'business', targetId: ID, sessionId: 'dev-aaaaaaa', createdAt: ago(1, 60_000) },
      // device B: called BEFORE searching -> not converted; first seen 15 days ago, only active 2 days -> not returned
      { type: 'contact_click', targetType: 'business', targetId: ID, sessionId: 'dev-bbbbbbb', createdAt: ago(15) },
      { type: 'search', sessionId: 'dev-bbbbbbb', createdAt: ago(14) },
      // device C: new today (too recent for the retention cohort); viewed and shared an event
      { type: 'view', targetType: 'event', targetId: ID, sessionId: 'dev-ccccccc', createdAt: ago(0) },
      { type: 'share', targetType: 'event', targetId: ID, sessionId: 'dev-ccccccc', createdAt: ago(0) },
    ]);
    await createBusiness({ name: 'Fresh' });
    const { Business } = await import('../businesses/businesses.model.js');
    const stale = await createBusiness({ name: 'Stale' });
    await Business.collection.updateOne({ _id: stale._id }, { $set: { updatedAt: new Date(now - 45 * DAY) } });

    const { agent } = await loginAs(app, 'admin');
    const from = istToday(new Date(now - 30 * DAY));
    const { metrics } = (await agent.get('/api/v1/admin/analytics/summary').query({ from, to: istToday() })).body.data;
    expect(metrics.activeDevices7d).toBe(2); // A and C
    expect(metrics.searchToContact).toEqual({ searchSessions: 2, converted: 1, rate: 50 });
    expect(metrics.events).toEqual({ views: 1, shares: 1 });
    expect(metrics.retention7d).toEqual({ cohort: 2, returned: 1, rate: 50 }); // A returned, B did not; C too recent
    expect(metrics.freshness.businesses).toEqual({ total: 2, fresh: 1, rate: 50 });
    expect(metrics.freshness).toMatchObject({ days: 30, offers: { total: 0, fresh: 0, rate: null }, events: { total: 0, rate: null } });
  });

  it('is admin-only', async () => {
    const { agent } = await loginAs(app, 'owner');
    expect((await agent.get('/api/v1/admin/analytics/summary')).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/analytics/summary')).status).toBe(401);
  });
});
