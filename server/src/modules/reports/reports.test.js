import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs, createBusiness, createUser, createCategory, TEST_PASSWORD } from '../../tests/factories.js';
import { Business } from '../businesses/businesses.model.js';
import { Offer } from '../offers/offers.model.js';
import { Event } from '../events/events.model.js';
import { News } from '../news/news.model.js';
import { Review } from '../reviews/reviews.model.js';
import { User } from '../users/users.model.js';
import { Report } from './reports.model.js';

let app;
const DAY = 86_400_000;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function content() {
  const owner = await createUser({ role: 'owner' });
  const biz = await createBusiness({ name: 'Padma Meals', ownerId: owner._id });
  const author = await createUser();
  const review = await Review.create({ businessId: biz._id, userId: author._id, rating: 1, comment: 'Bad words' });
  const offer = await Offer.create({ businessId: biz._id, title: 'Free sweet', discountLabel: 'Free', terms: 'x', validFrom: new Date(Date.now() - DAY), validTo: new Date(Date.now() + DAY), status: 'published' });
  const cat = await createCategory({ type: 'event', slug: 'fest' });
  const submitter = await createUser();
  const event = await Event.create({ title: 'Fair', slug: 'fair', categoryId: cat._id, organizerName: 'Club', venue: { name: 'Hall', address: 'Road', area: 'Main Road' }, startAt: new Date(Date.now() + DAY), endAt: new Date(Date.now() + DAY + 3_600_000), status: 'published', source: 'community', submittedBy: submitter._id });
  const news = await News.create({ title: 'Power cut', slug: 'power-cut', summary: 'No power 10 to 2 today.', type: 'power', sourceName: 'Office', status: 'published', publishedAt: new Date() });
  return { owner, biz, author, review, offer, submitter, event, news };
}

describe('reporting content and sending suggestions (FR-REP-1, U1)', () => {
  it('any signed-in user reports public content of every type; the reporter sees only a receipt', async () => {
    const c = await content();
    const { agent } = await loginAs(app, 'user');
    for (const [targetType, doc] of [['business', c.biz], ['review', c.review], ['offer', c.offer], ['event', c.event], ['news', c.news]]) {
      const res = await agent.post('/api/v1/reports').send({ targetType, targetId: String(doc._id), reason: 'wrong_info', details: 'Phone number is wrong.' });
      expect(res.status).toBe(201);
      expect(Object.keys(res.body.data).sort()).toEqual(['createdAt', 'id', 'reason', 'status', 'targetType']);
    }
    expect(await Report.countDocuments({ status: 'open' })).toBe(5);
    // the same person can't report the same thing twice while it is open
    expect((await agent.post('/api/v1/reports').send({ targetType: 'business', targetId: String(c.biz._id), reason: 'spam' })).status).toBe(409);
    // someone else can
    const other = await loginAs(app, 'owner');
    expect((await other.agent.post('/api/v1/reports').send({ targetType: 'business', targetId: String(c.biz._id), reason: 'closed' })).status).toBe(201);
  });

  it('hidden or missing content is 404; validation; sign-in required', async () => {
    const hidden = await createBusiness({ status: 'hidden' });
    const { agent } = await loginAs(app, 'user');
    const post = (body) => agent.post('/api/v1/reports').send(body);
    expect((await post({ targetType: 'business', targetId: String(hidden._id), reason: 'spam' })).status).toBe(404);
    expect((await post({ targetType: 'review', targetId: '64d0de0000000000000000aa', reason: 'spam' })).status).toBe(404);
    const pub = await createBusiness();
    expect((await post({ targetType: 'business', targetId: String(pub._id), reason: 'other' })).status).toBe(400); // "other" needs details
    expect((await post({ targetType: 'business', targetId: String(pub._id), reason: 'idea' })).status).toBe(400);
    expect((await post({ targetType: 'business', targetId: String(pub._id), reason: 'spam', status: 'actioned' })).status).toBe(400);
    expect((await post({ targetType: 'user', targetId: String(pub._id), reason: 'spam' })).status).toBe(400);
    expect((await request(app).post('/api/v1/reports').set('Origin', TEST_ORIGIN).send({ targetType: 'business', targetId: String(pub._id), reason: 'spam' })).status).toBe(401);
  });

  it('suggestions (the Suggest button) need a kind and a few words, and no target', async () => {
    const { agent } = await loginAs(app, 'user');
    const ok = await agent.post('/api/v1/reports').send({ targetType: 'suggestion', reason: 'new_business', details: 'Ravi Tea Stall near the bus stand is missing.' });
    expect(ok.status).toBe(201);
    expect(await Report.findById(ok.body.data.id).lean()).toMatchObject({ targetType: 'suggestion', reason: 'new_business', status: 'open' });
    expect((await agent.post('/api/v1/reports').send({ targetType: 'suggestion', reason: 'idea', details: 'short' })).status).toBe(400);
    expect((await agent.post('/api/v1/reports').send({ targetType: 'suggestion', reason: 'spam', details: 'A long enough text.' })).status).toBe(400);
    expect((await agent.post('/api/v1/reports').send({ targetType: 'suggestion', targetId: '64d0de0000000000000000aa', reason: 'idea', details: 'A long enough text.' })).status).toBe(400);
  });
});

describe('admin moderation queue (FR-ADM-1)', () => {
  it('only admins see the queue: oldest open first, with the content, reporter and responsible user', async () => {
    const c = await content();
    const reporter = await loginAs(app, 'user');
    await reporter.agent.post('/api/v1/reports').send({ targetType: 'review', targetId: String(c.review._id), reason: 'offensive' });
    await reporter.agent.post('/api/v1/reports').send({ targetType: 'suggestion', reason: 'idea', details: 'Add bus timings please.' });
    expect((await reporter.agent.get('/api/v1/admin/reports')).status).toBe(403);
    const { agent } = await loginAs(app, 'admin');
    const res = await agent.get('/api/v1/admin/reports');
    expect(res.body.meta.total).toBe(2);
    const [first, second] = res.body.data;
    expect(first).toMatchObject({ targetType: 'review', reason: 'offensive', target: { status: 'published', isPublic: true, businessId: String(c.biz._id) }, reporter: { email: reporter.user.email }, responsibleUser: { email: c.author.email } });
    expect(second).toMatchObject({ targetType: 'suggestion', target: null, details: 'Add bus timings please.' });
    expect((await agent.get('/api/v1/admin/reports').query({ targetType: 'suggestion' })).body.data).toHaveLength(1);
    expect((await agent.get('/api/v1/admin/reports').query({ status: 'dismissed' })).body.data).toEqual([]);
  });

  it('hide the content through its own module; other open reports on it are closed too', async () => {
    const c = await content();
    const a = await loginAs(app, 'user');
    const b = await loginAs(app, 'user');
    const r1 = (await a.agent.post('/api/v1/reports').send({ targetType: 'business', targetId: String(c.biz._id), reason: 'fraud' })).body.data;
    const r2 = (await b.agent.post('/api/v1/reports').send({ targetType: 'business', targetId: String(c.biz._id), reason: 'spam' })).body.data;
    const admin = await loginAs(app, 'admin');
    const res = await admin.agent.patch(`/api/v1/admin/reports/${r1.id}`).send({ action: 'hide_target', note: 'Fake listing' });
    expect(res.body.data).toMatchObject({ status: 'actioned', resolution: { action: 'hide_target', note: 'Fake listing' }, handledBy: admin.user.name, target: { status: 'hidden', isPublic: false } });
    expect((await Business.findById(c.biz._id).lean()).status).toBe('hidden');
    expect((await Report.findById(r2.id).lean()).status).toBe('actioned');
    expect((await admin.agent.patch(`/api/v1/admin/reports/${r1.id}`).send({ action: 'dismiss' })).status).toBe(409); // already handled

    // each content type hides through its module (business visible again, so its review and offer are public)
    await Business.updateOne({ _id: c.biz._id }, { status: 'published' });
    for (const [targetType, doc, check] of [
      ['review', c.review, async () => (await Review.findById(c.review._id).lean()).status],
      ['offer', c.offer, async () => (await Offer.findById(c.offer._id).lean()).status],
      ['event', c.event, async () => (await Event.findById(c.event._id).lean()).status],
      ['news', c.news, async () => (await News.findById(c.news._id).lean()).status],
    ]) {
      await Report.create({ reporterId: a.user._id, targetType, targetId: doc._id, reason: 'spam' });
      const rep = await Report.findOne({ targetType, status: 'open' });
      expect((await admin.agent.patch(`/api/v1/admin/reports/${rep._id}`).send({ action: 'hide_target' })).status).toBe(200);
      expect(await check()).toBe('hidden');
    }
    expect((await Event.findById(c.event._id).lean()).moderationLog.at(-1).action).toBe('hidden'); // the event's own audit trail
  });

  it('block the responsible user (review author, owner, submitter); never admins; news has nobody to block', async () => {
    const c = await content();
    const a = await loginAs(app, 'user');
    const rep = (await a.agent.post('/api/v1/reports').send({ targetType: 'review', targetId: String(c.review._id), reason: 'offensive' })).body.data;
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.patch(`/api/v1/admin/reports/${rep.id}`).send({ action: 'hide_and_block' })).body.data.status).toBe('actioned');
    expect((await User.findById(c.author._id).lean()).status).toBe('blocked');
    expect((await Review.findById(c.review._id).lean()).status).toBe('hidden');
    const login = await request(app).post('/api/v1/auth/login').set('Origin', TEST_ORIGIN).send({ email: c.author.email, password: TEST_PASSWORD });
    expect(login.status).toBe(403);

    const newsRep = (await a.agent.post('/api/v1/reports').send({ targetType: 'news', targetId: String(c.news._id), reason: 'wrong_info' })).body.data;
    expect((await admin.agent.patch(`/api/v1/admin/reports/${newsRep.id}`).send({ action: 'block_user' })).status).toBe(409);

    const adminOwned = await createBusiness({ ownerId: admin.user._id });
    const adminRep = (await a.agent.post('/api/v1/reports').send({ targetType: 'business', targetId: String(adminOwned._id), reason: 'spam' })).body.data;
    expect((await admin.agent.patch(`/api/v1/admin/reports/${adminRep.id}`).send({ action: 'block_user' })).status).toBe(409);
    expect((await User.findById(admin.user._id).lean()).status).toBe('active');

    const eventRep = (await a.agent.post('/api/v1/reports').send({ targetType: 'event', targetId: String(c.event._id), reason: 'fraud' })).body.data;
    await admin.agent.patch(`/api/v1/admin/reports/${eventRep.id}`).send({ action: 'block_user' });
    expect((await User.findById(c.submitter._id).lean()).status).toBe('blocked');
  });

  it('dismiss and mark reviewed; suggestions cannot be hidden; deleted content shows as missing', async () => {
    const c = await content();
    const a = await loginAs(app, 'user');
    const s = (await a.agent.post('/api/v1/reports').send({ targetType: 'suggestion', reason: 'correction', details: 'The bus stand moved last month.' })).body.data;
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.patch(`/api/v1/admin/reports/${s.id}`).send({ action: 'hide_target' })).status).toBe(409);
    expect((await admin.agent.patch(`/api/v1/admin/reports/${s.id}`).send({ action: 'mark_reviewed' })).body.data.status).toBe('reviewed');
    expect((await admin.agent.patch(`/api/v1/admin/reports/${s.id}`).send({ action: 'dismiss', note: 'Already fixed' })).body.data).toMatchObject({ status: 'dismissed', resolution: { note: 'Already fixed' } });
    expect((await admin.agent.patch(`/api/v1/admin/reports/${s.id}`).send({ action: 'bogus' })).status).toBe(400);

    const r = (await a.agent.post('/api/v1/reports').send({ targetType: 'review', targetId: String(c.review._id), reason: 'spam' })).body.data;
    await Review.deleteOne({ _id: c.review._id }); // the author deleted it
    expect((await admin.agent.get('/api/v1/admin/reports')).body.data.find((x) => x.id === r.id).target).toBeNull();
    expect((await admin.agent.patch(`/api/v1/admin/reports/${r.id}`).send({ action: 'hide_target' })).status).toBe(409);
    expect((await admin.agent.patch('/api/v1/admin/reports/64d0de0000000000000000aa').send({ action: 'dismiss' })).status).toBe(404);
  });

  it('uses the (status, createdAt) index for the queue', async () => {
    await Report.init();
    const plan = await Report.find({ status: 'open' }).sort({ createdAt: 1 }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
  });
});
