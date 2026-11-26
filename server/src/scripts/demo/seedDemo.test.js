import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN, enterProductionEnv } from '../../tests/helpers.js';
import { resetEnvCache } from '../../config/env.js';
import { seedDemo, isLocalMongoUri, assertDemoTarget, listEvidenceFixtures } from './seedDemo.js';
import { DEMO_USERS, DEMO_SUBMISSIONS } from './demoData.js';
import { User } from '../../modules/users/users.model.js';
import { Business } from '../../modules/businesses/businesses.model.js';
import { Offer } from '../../modules/offers/offers.model.js';
import { Event } from '../../modules/events/events.model.js';
import { EventEvidence } from '../../modules/events/evidence.model.js';
import { News } from '../../modules/news/news.model.js';

const demoScript = fileURLToPath(new URL('../demo.js', import.meta.url));
const counts = async () => ({
  users: await User.countDocuments(),
  businesses: await Business.countDocuments(),
  offers: await Offer.countDocuments(),
  events: await Event.countDocuments(),
  evidence: await EventEvidence.countDocuments(),
  news: await News.countDocuments(),
});
const login = async (app, email, password) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').set('Origin', TEST_ORIGIN).send({ email, password });
  return { agent, status: res.status };
};
const PRIVATE = /mana-tenali\/evidence|moderationLog|submittedBy|"review"|"evidence"|reviewedBy|demo-poster|demo-venue-letter/;

describe('demo data guards', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });

  it('only accepts a local, plain MongoDB as the target', () => {
    expect(isLocalMongoUri('mongodb://127.0.0.1:51234/demo')).toBe(true);
    expect(isLocalMongoUri('mongodb://localhost:27017')).toBe(true);
    expect(isLocalMongoUri('mongodb://[::1]:27017/')).toBe(true);
    expect(isLocalMongoUri('mongodb+srv://user:pass@cluster0.abcde.mongodb.net/app')).toBe(false);
    expect(isLocalMongoUri('mongodb://db.example.com:27017/app')).toBe(false);
    expect(isLocalMongoUri('mongodb://localhost.evil.example:27017/app')).toBe(false);
    expect(isLocalMongoUri('')).toBe(false);
    expect(() => assertDemoTarget({ uri: 'mongodb+srv://cluster0.abcde.mongodb.net/app' })).toThrow(/local, disposable MongoDB/);
  });

  it('refuses production - in the loader and in the npm run demo script - before connecting anywhere', () => {
    expect(() => assertDemoTarget({ uri: 'mongodb://127.0.0.1:1/x', nodeEnv: 'production' })).toThrow(/never loaded in production/);
    enterProductionEnv();
    expect(() => assertDemoTarget({ uri: 'mongodb://127.0.0.1:1/x' })).toThrow(/never loaded in production/);

    const res = spawnSync(process.execPath, [demoScript, '--api-only'], {
      env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, NODE_ENV: 'production' },
      encoding: 'utf8',
      timeout: 20_000,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/NODE_ENV is production/);
    expect(res.stdout).not.toMatch(/demo data:/);
  });

  it('ships only synthetic fixture files', () => {
    const fixtures = listEvidenceFixtures();
    expect(fixtures.length).toBe(DEMO_SUBMISSIONS.reduce((n, s) => n + s.evidence.length, 0));
    for (const f of fixtures) {
      expect(existsSync(f.path)).toBe(true);
      expect(f.publicId).toMatch(/^mana-tenali\/evidence\/u_[0-9a-f]{24}\/demo-/);
    }
  });
});

describe('demo data load', () => {
  let app;
  beforeAll(async () => {
    await connectTestDb();
    app = buildTestApp();
  });
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it('is repeatable: a second run creates nothing and changes no counts', async () => {
    const first = await seedDemo();
    expect(first.users).toBe(DEMO_USERS.length);
    expect(first.evidence).toBeGreaterThanOrEqual(5);
    const before = await counts();
    const second = await seedDemo();
    expect(second).toEqual({ users: 0, businesses: 0, offers: 0, events: 0, evidence: 0, news: 0, reviews: 0, favorites: 0, reports: 0, posts: 0 });
    expect(await counts()).toEqual(before);
  });

  it('adds reviews (ratings recalculated), saved items and open reports for Step 9', async () => {
    const summary = await seedDemo();
    expect(summary).toMatchObject({ reviews: 5, favorites: 4, reports: 3, posts: 4 });
    const padma = await Business.findOne({ slug: 'demo-padma-andhra-meals' }).lean();
    expect(padma).toMatchObject({ ratingAvg: 4.5, ratingCount: 2 });
    const biryani = await Business.findOne({ slug: 'sample-kothapeta-biryani-house' }).lean();
    expect(biryani).toMatchObject({ ratingAvg: 4, ratingCount: 1 }); // the hidden review does not count

    const user = await login(app, 'user@demo.example', 'DemoUser#2026');
    const saved = (await user.agent.get('/api/v1/favorites')).body.data;
    expect(saved).toHaveLength(4);
    expect(saved.filter((f) => f.item === null)).toHaveLength(1); // the hidden business: "no longer available"
    const admin = await login(app, 'admin@demo.example', 'DemoAdmin#2026');
    const queue = (await admin.agent.get('/api/v1/admin/reports')).body.data;
    expect(queue.map((r) => r.targetType).sort()).toEqual(['business', 'review', 'suggestion']);
  });

  it('covers every status the features need, with dates relative to today', async () => {
    await seedDemo();
    const statuses = async (Model, field = 'status') => new Set((await Model.find().select(field).lean()).map((d) => d[field]));
    expect([...(await statuses(Business))].sort()).toEqual(['archived', 'draft', 'hidden', 'pending', 'published', 'rejected']);
    expect([...(await statuses(Event))].sort()).toEqual(['cancelled', 'changes_requested', 'draft', 'hidden', 'pending_review', 'published', 'rejected', 'withdrawn']);
    expect([...(await statuses(Offer))].sort()).toEqual(['draft', 'hidden', 'published']);
    expect([...(await statuses(News))].sort()).toEqual(['archived', 'draft', 'hidden', 'published']);
    expect(await News.exists({ status: 'published', validUntil: { $lt: new Date() } })).toBeTruthy(); // expired notice
    expect(await News.exists({ isSeed: { $ne: true } })).toBeFalsy();

    const now = Date.now();
    const published = await Offer.find({ status: 'published' }).lean();
    expect(published.some((o) => o.validTo < now)).toBe(true); // expired
    expect(published.some((o) => o.validFrom > now)).toBe(true); // upcoming
    expect(published.some((o) => o.validFrom <= now && o.validTo >= now)).toBe(true); // live
    expect(await Event.exists({ status: 'published', endAt: { $lt: new Date(now) } })).toBeTruthy(); // past event
    expect(await Business.exists({ isSeed: { $ne: true } })).toBeFalsy();
    expect(await Business.exists({ isVerified: true })).toBeFalsy();
  });

  it('demo accounts sign in with the documented development passwords; the blocked one cannot', async () => {
    await seedDemo();
    for (const u of DEMO_USERS) {
      const { status } = await login(app, u.email, u.password);
      expect(status).toBe(u.status === 'blocked' ? 403 : 200);
    }
    const admin = await login(app, 'admin@demo.example', 'DemoAdmin#2026');
    expect((await admin.agent.get('/api/v1/admin/event-submissions')).status).toBe(200);
    const user = await login(app, 'user@demo.example', 'DemoUser#2026');
    expect((await user.agent.get('/api/v1/admin/event-submissions')).status).toBe(403);
  });

  it('public APIs show only public records and never expose private evidence', async () => {
    await seedDemo();
    const pub = (path) => request(app).get(`/api/v1${path}`);

    const events = await pub('/events?limit=50&includePast=true');
    const titles = events.body.data.map((e) => e.title);
    expect(titles).toEqual(expect.arrayContaining(['Andhra Food Festival (Demo)', 'Telugu Drama Night (Demo - past)', 'Inter-school Cricket Final (Demo - cancelled)', 'School Science Expo (Demo - approved submission)']));
    for (const hiddenTitle of ['pending review', 'changes requested', 'rejected', 'withdrawn', 'hidden', 'draft']) {
      expect(titles.some((t) => t.toLowerCase().includes(`demo - ${hiddenTitle}`))).toBe(false);
    }
    expect(JSON.stringify(events.body)).not.toMatch(PRIVATE);
    for (const slug of events.body.data.map((e) => e.slug)) {
      const detail = await pub(`/events/${slug}`);
      expect(detail.status).toBe(200);
      expect(JSON.stringify(detail.body)).not.toMatch(PRIVATE);
    }
    for (const slug of ['demo-sub-temple-annadanam', 'demo-sub-rangoli-contest', 'demo-sub-unverified-concert', 'demo-hidden-yoga-camp', 'demo-draft-blood-donation']) {
      expect((await pub(`/events/${slug}`)).status).toBe(404);
    }

    const offers = await pub('/offers?limit=50');
    const offerTitles = offers.body.data.map((o) => o.title);
    expect(offerTitles).toContain('Free sweet with family meals (Demo)');
    for (const t of ['expired', 'hidden', 'draft', 'upcoming', 'business hidden']) expect(offerTitles.some((x) => x.includes(`Demo - ${t}`))).toBe(false);

    const news = (await pub('/news?limit=50')).body.data;
    expect(news[0]).toMatchObject({ isPinned: true });
    expect(news.map((n) => n.slug)).toContain('demo-heavy-rain-alert');
    for (const slug of ['demo-expired-power-cut', 'demo-hidden-traffic-diversion', 'demo-draft-sports-meet', 'demo-removed-old-notice']) {
      expect(news.map((n) => n.slug)).not.toContain(slug);
    }
    expect((await pub('/news/demo-expired-power-cut')).body.data).toMatchObject({ isExpired: true });
    for (const slug of ['demo-hidden-traffic-diversion', 'demo-draft-sports-meet', 'demo-removed-old-notice']) {
      expect((await pub(`/news/${slug}`)).status).toBe(404);
    }

    const businesses = (await pub('/businesses?limit=50')).body.data.map((b) => b.slug);
    expect(businesses).toContain('demo-padma-andhra-meals');
    for (const s of ['demo-padma-home-bakery', 'demo-suresh-cycle-store', 'demo-suresh-photo-studio', 'demo-anil-tea-stall', 'demo-lakshmi-mobile-repairs']) {
      expect(businesses).not.toContain(s);
    }
  });

  it('evidence is visible only to the submitter and admins', async () => {
    await seedDemo();
    const ev = await Event.findOne({ slug: 'demo-sub-temple-annadanam' }).lean();
    const owner = await login(app, 'user@demo.example', 'DemoUser#2026');
    const mine = await owner.agent.get(`/api/v1/events/submissions/${ev._id}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.evidence).toHaveLength(2);
    expect(JSON.stringify(mine.body)).not.toMatch(/mana-tenali\/evidence/); // no storage ids, even for the owner
    const other = await login(app, 'user2@demo.example', 'DemoUser#2026');
    expect((await other.agent.get(`/api/v1/events/submissions/${ev._id}`)).status).toBe(404);
    const evidenceId = mine.body.data.evidence[0].id;
    expect((await other.agent.post(`/api/v1/events/submissions/${ev._id}/evidence/${evidenceId}/access`).set('Origin', TEST_ORIGIN)).status).toBe(404);
    expect((await request(app).post(`/api/v1/events/submissions/${ev._id}/evidence/${evidenceId}/access`).set('Origin', TEST_ORIGIN)).status).toBe(401);
    const admin = await login(app, 'admin@demo.example', 'DemoAdmin#2026');
    const review = await admin.agent.get(`/api/v1/admin/event-submissions/${ev._id}`);
    expect(review.body.data.evidence).toHaveLength(2);
  });
});
