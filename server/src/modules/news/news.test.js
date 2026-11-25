import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb } from '../../tests/helpers.js';
import { loginAs, createCategory } from '../../tests/factories.js';
import { toIstDateTime } from '../../common/utils/dates.js';
import { resetEnvCache } from '../../config/env.js';
import { News, MAX_PINNED } from './news.model.js';
import { seedNews, listPublic } from './news.service.js';

let app;
let civic;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  civic = await createCategory({ type: 'news', slug: 'civic', name: { en: 'Civic' } });
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const istIn = (ms) => toIstDateTime(new Date(Date.now() + ms));
const PRIVATE_FIELDS = /createdBy|updatedBy|"status"/;
const COVER = { url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/news/cover1.jpg', publicId: 'mana-tenali/news/cover1' };

let seq = 0;
/** Insert a news item directly (published by default). */
async function newsItem(o = {}) {
  seq += 1;
  const doc = await News.create({
    title: `News ${seq}`,
    slug: `news-${seq}`,
    summary: 'A short summary of the item.',
    type: 'news',
    sourceName: 'Municipal office',
    status: 'published',
    publishedAt: new Date(Date.now() - seq * 60_000),
    ...o,
  });
  return doc.toObject();
}

const body = (o = {}) => ({
  title: 'Water supply interrupted in ward 5',
  summary: 'No supply between 6 am and 11 am for pipeline repair.',
  type: 'water',
  sourceName: 'Municipal water works',
  ...o,
});

describe('public list and detail (FR-NEWS-1, FR-NEWS-2)', () => {
  it('lists only published items that have not expired; draft, hidden, removed and expired are left out', async () => {
    await newsItem({ title: 'Live', slug: 'live' });
    await newsItem({ title: 'Live notice', slug: 'live-notice', type: 'power', validUntil: new Date(Date.now() + HOUR) });
    await newsItem({ title: 'Expired notice', slug: 'expired-notice', type: 'power', validUntil: new Date(Date.now() - HOUR) });
    for (const status of ['draft', 'hidden', 'archived']) await newsItem({ title: `Private ${status}`, slug: `private-${status}`, status });

    const list = await request(app).get('/api/v1/news');
    expect(list.status).toBe(200);
    expect(list.body.data.map((n) => n.title).sort()).toEqual(['Live', 'Live notice']);
    expect(list.body.data[0].body).toBeUndefined(); // list payload omits the body
    expect(JSON.stringify(list.body)).not.toMatch(PRIVATE_FIELDS);

    for (const status of ['draft', 'hidden', 'archived']) {
      expect((await request(app).get(`/api/v1/news/private-${status}`)).status).toBe(404);
    }
    expect((await request(app).get('/api/v1/news/no-such-item')).status).toBe(404);
  });

  it('detail shows body, source and times; an expired notice still opens, labelled expired', async () => {
    const until = new Date(Date.now() + 2 * HOUR);
    await newsItem({ slug: 'cut', type: 'power', body: 'Line maintenance.', sourceUrl: 'https://example.com/n', categoryId: civic._id, validUntil: until });
    const d = await request(app).get('/api/v1/news/cut');
    expect(d.status).toBe(200);
    expect(d.body.data).toMatchObject({
      body: 'Line maintenance.',
      sourceName: 'Municipal office',
      sourceUrl: 'https://example.com/n',
      category: { name: { en: 'Civic' } },
      validUntilLocal: toIstDateTime(until),
      isExpired: false,
    });
    expect(d.body.data.publishedAt).toBeTruthy();
    expect(d.body.data.updatedAt).toBeTruthy();
    expect(JSON.stringify(d.body)).not.toMatch(PRIVATE_FIELDS);

    await News.updateOne({ slug: 'cut' }, { validUntil: new Date(Date.now() - HOUR) });
    const expired = await request(app).get('/api/v1/news/cut');
    expect(expired.status).toBe(200);
    expect(expired.body.data.isExpired).toBe(true);
  });

  it('pinned first, then newest; filters by type and category; paginates', async () => {
    const now = Date.now();
    await newsItem({ title: 'Old pinned', isPinned: true, publishedAt: new Date(now - 3 * DAY) });
    await newsItem({ title: 'Newest', publishedAt: new Date(now - HOUR) });
    await newsItem({ title: 'Older traffic', type: 'traffic', categoryId: civic._id, publishedAt: new Date(now - DAY) });
    const titles = async (q) => (await request(app).get('/api/v1/news').query(q)).body.data.map((n) => n.title);
    expect(await titles({})).toEqual(['Old pinned', 'Newest', 'Older traffic']);
    expect(await titles({ type: 'traffic' })).toEqual(['Older traffic']);
    expect(await titles({ categoryId: String(civic._id) })).toEqual(['Older traffic']);
    const p = await request(app).get('/api/v1/news').query({ limit: 1, page: 2 });
    expect(p.body.data.map((n) => n.title)).toEqual(['Newest']);
    expect(p.body.meta).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
    expect((await request(app).get('/api/v1/news').query({ type: 'gossip' })).status).toBe(400);
    expect((await request(app).get('/api/v1/news').query({ categoryId: 'nope' })).status).toBe(400);
  });

  it('uses indexes for the public list', async () => {
    await News.init();
    const keys = (await News.collection.indexes()).map((i) => Object.keys(i.key).join(','));
    expect(keys).toEqual(expect.arrayContaining(['status,type,publishedAt', '_fts,_ftsx', 'slug', 'status,isPinned,publishedAt']));
    await newsItem();
    const filter = { status: 'published', $or: [{ validUntil: null }, { validUntil: { $gt: new Date() } }] };
    const plan = await News.find(filter).sort({ isPinned: -1, publishedAt: -1, _id: -1 }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
    const typed = await News.find({ ...filter, type: 'power' }).sort({ isPinned: -1, publishedAt: -1 }).explain('queryPlanner');
    expect(JSON.stringify(typed)).toMatch(/IXSCAN/);
  });
});

describe('permissions', () => {
  it('only admins create, edit, remove and see the management list', async () => {
    const item = await newsItem({ slug: 'x' });
    const id = String(item._id);
    const anon = request(app);
    expect((await anon.post('/api/v1/news').set('Origin', 'http://localhost:5173').send(body())).status).toBe(401);
    expect((await anon.get('/api/v1/admin/news')).status).toBe(401);
    for (const role of ['user', 'owner']) {
      const { agent } = await loginAs(app, role);
      expect((await agent.post('/api/v1/news').send(body())).status).toBe(403);
      expect((await agent.patch(`/api/v1/news/${id}`).send({ title: 'Changed title' })).status).toBe(403);
      expect((await agent.delete(`/api/v1/news/${id}`)).status).toBe(403);
      expect((await agent.get('/api/v1/admin/news')).status).toBe(403);
      expect((await agent.get(`/api/v1/admin/news/${id}`)).status).toBe(403);
    }
    expect((await News.findById(id).lean()).title).toBe(item.title);
  });

  it('admin gets 404 for unknown ids and 400 for bad ids', async () => {
    const { agent } = await loginAs(app, 'admin');
    const missing = '64d0de0000000000000000aa';
    expect((await agent.patch(`/api/v1/news/${missing}`).send({ title: 'Anything' })).status).toBe(404);
    expect((await agent.delete(`/api/v1/news/${missing}`)).status).toBe(404);
    expect((await agent.get(`/api/v1/admin/news/${missing}`)).status).toBe(404);
    expect((await agent.patch('/api/v1/news/not-an-id').send({ title: 'Anything' })).status).toBe(400);
  });
});

describe('admin news management (FR-NEWS-3)', () => {
  it('validates input and rejects server-owned fields', async () => {
    const { agent } = await loginAs(app, 'admin');
    const bad = async (o) => (await agent.post('/api/v1/news').send(body(o))).status;
    expect(await bad({ sourceName: undefined })).toBe(400); // source is required (trust)
    expect(await bad({ summary: 'short' })).toBe(400);
    expect(await bad({ type: 'gossip' })).toBe(400);
    expect(await bad({ sourceUrl: 'http://insecure.example.com' })).toBe(400);
    expect(await bad({ slug: 'my-slug' })).toBe(400);
    expect(await bad({ publishedAt: new Date().toISOString() })).toBe(400);
    expect(await bad({ isSeed: true })).toBe(400);
    expect(await bad({ status: 'archived' })).toBe(400);
    expect(await bad({ validUntil: '2026-13-01T10:00' })).toBe(400);
    expect(await bad({ coverImage: { url: 'https://evil.example.com/x.jpg', publicId: 'mana-tenali/news/x' } })).toBe(400);
    expect(await bad({ coverImage: { ...COVER, publicId: 'mana-tenali/events/cover1' } })).toBe(400); // wrong folder
    const eventCat = await createCategory({ type: 'event', slug: 'fairs' });
    expect(await bad({ categoryId: String(eventCat._id) })).toBe(400);
    const inactive = await createCategory({ type: 'news', slug: 'old', isActive: false });
    expect(await bad({ categoryId: String(inactive._id) })).toBe(400);
    expect(await News.countDocuments()).toBe(0);
  });

  it('creates a draft, publishes, hides and re-publishes (first publish time kept); removal is soft and final', async () => {
    const { agent } = await loginAs(app, 'admin');
    const draft = await agent.post('/api/v1/news').send(body({ categoryId: String(civic._id), coverImage: COVER, body: 'Details here.' }));
    expect(draft.status).toBe(201);
    expect(draft.body.data).toMatchObject({ status: 'draft', slug: 'water-supply-interrupted-in-ward-5', publishedAt: null, coverImage: COVER, categoryId: String(civic._id) });
    const { id, slug } = draft.body.data;
    expect((await request(app).get(`/api/v1/news/${slug}`)).status).toBe(404);
    expect((await agent.get(`/api/v1/news/${slug}`)).body.data.status).toBe('draft'); // admin preview

    const pub = await agent.patch(`/api/v1/news/${id}`).send({ status: 'published' });
    expect(pub.body.data.status).toBe('published');
    const firstPublished = pub.body.data.publishedAt;
    expect(firstPublished).toBeTruthy();
    expect((await request(app).get('/api/v1/news')).body.data.map((n) => n.id)).toEqual([id]);

    expect((await agent.patch(`/api/v1/news/${id}`).send({ status: 'hidden' })).body.data.status).toBe('hidden');
    expect((await request(app).get(`/api/v1/news/${slug}`)).status).toBe(404);
    const again = await agent.patch(`/api/v1/news/${id}`).send({ status: 'published', title: 'Water supply restored in ward 5' });
    expect(again.body.data).toMatchObject({ status: 'published', publishedAt: firstPublished, slug }); // slug never changes

    const del = await agent.delete(`/api/v1/news/${id}`);
    expect(del.body.data).toEqual({ id, status: 'archived' });
    expect(await News.countDocuments({ _id: id })).toBe(1);
    expect((await request(app).get(`/api/v1/news/${slug}`)).status).toBe(404);
    expect((await agent.patch(`/api/v1/news/${id}`).send({ status: 'published' })).status).toBe(409);
    expect((await agent.delete(`/api/v1/news/${id}`)).status).toBe(409);
    const archived = await agent.get('/api/v1/admin/news').query({ status: 'archived' });
    expect(archived.body.data.map((n) => n.id)).toEqual([id]);
  });

  it('clears optional fields with null and keeps a unique slug for repeated titles', async () => {
    const { agent } = await loginAs(app, 'admin');
    const a = await agent.post('/api/v1/news').send(body({ categoryId: String(civic._id), coverImage: COVER, sourceUrl: 'https://example.com/a' }));
    const b = await agent.post('/api/v1/news').send(body());
    expect(b.body.data.slug).not.toBe(a.body.data.slug);
    const cleared = await agent.patch(`/api/v1/news/${a.body.data.id}`).send({ categoryId: null, coverImage: null, sourceUrl: null, validUntil: null });
    expect(cleared.body.data).toMatchObject({ categoryId: null, coverImage: null, sourceUrl: null, validUntil: null });
    expect((await agent.patch(`/api/v1/news/${a.body.data.id}`).send({})).status).toBe(400);
  });

  it('time-limited notices: "show until" in IST must be in the future (only when changed) and within a year', async () => {
    const { agent } = await loginAs(app, 'admin');
    expect((await agent.post('/api/v1/news').send(body({ validUntil: istIn(-HOUR) }))).status).toBe(400);
    expect((await agent.post('/api/v1/news').send(body({ validUntil: istIn(400 * DAY) }))).status).toBe(400);
    const until = istIn(5 * HOUR).slice(0, 16);
    const ok = await agent.post('/api/v1/news').send(body({ validUntil: until, status: 'published' }));
    expect(ok.status).toBe(201);
    expect(ok.body.data.validUntilLocal).toBe(until);
    const stored = await News.findById(ok.body.data.id).lean();
    expect(toIstDateTime(stored.validUntil)).toBe(until); // stored in UTC, entered in IST

    // Once expired: it leaves the list; editing with the unchanged time still works; re-publishing needs a new time.
    const past = new Date(Date.now() - HOUR);
    await News.updateOne({ _id: ok.body.data.id }, { validUntil: past, status: 'hidden' });
    expect((await request(app).get('/api/v1/news')).body.data).toEqual([]);
    const edit = await agent.patch(`/api/v1/news/${ok.body.data.id}`).send({ title: 'Typo fixed in title', validUntil: toIstDateTime(past) });
    expect(edit.status).toBe(200);
    expect((await agent.patch(`/api/v1/news/${ok.body.data.id}`).send({ status: 'published' })).status).toBe(400);
    const extended = await agent.patch(`/api/v1/news/${ok.body.data.id}`).send({ status: 'published', validUntil: istIn(DAY) });
    expect(extended.body.data).toMatchObject({ status: 'published', isExpired: false });
    expect((await agent.post('/api/v1/news').send(body({ validUntil: istIn(-HOUR), status: 'published' }))).status).toBe(400);
  });

  it(`pins at most ${MAX_PINNED} live items; removing unpins; expired pins don't count`, async () => {
    const { agent } = await loginAs(app, 'admin');
    const ids = [];
    for (let i = 0; i < MAX_PINNED; i += 1) {
      const r = await agent.post('/api/v1/news').send(body({ title: `Pinned notice ${i}`, isPinned: true, status: 'published' }));
      expect(r.body.data.isPinned).toBe(true);
      ids.push(r.body.data.id);
    }
    const extra = await agent.post('/api/v1/news').send(body({ title: 'One too many' }));
    expect((await agent.patch(`/api/v1/news/${extra.body.data.id}`).send({ isPinned: true })).status).toBe(409);
    expect((await agent.post('/api/v1/news').send(body({ title: 'Also too many', isPinned: true }))).status).toBe(409);
    // re-sending isPinned: true on an already pinned item is fine
    expect((await agent.patch(`/api/v1/news/${ids[0]}`).send({ isPinned: true, title: 'Pinned notice zero' })).status).toBe(200);

    await agent.delete(`/api/v1/news/${ids[0]}`);
    expect((await News.findById(ids[0]).lean()).isPinned).toBe(false);
    expect((await agent.patch(`/api/v1/news/${extra.body.data.id}`).send({ isPinned: true })).body.data.isPinned).toBe(true);

    await News.updateOne({ _id: ids[1] }, { validUntil: new Date(Date.now() - HOUR) });
    const another = await agent.post('/api/v1/news').send(body({ title: 'Fits after expiry', isPinned: true }));
    expect(another.status).toBe(201);
    expect((await agent.patch(`/api/v1/news/${ids[2]}`).send({ isPinned: false })).body.data.isPinned).toBe(false);
  });

  it('management list filters by status, type and title search; any status is visible', async () => {
    await newsItem({ title: 'Bus stand traffic', type: 'traffic' });
    await newsItem({ title: 'Draft note', status: 'draft' });
    await newsItem({ title: 'Hidden note', status: 'hidden' });
    const { agent } = await loginAs(app, 'admin');
    const titles = async (q) => (await agent.get('/api/v1/admin/news').query(q)).body.data.map((n) => n.title).sort();
    expect(await titles({})).toEqual(['Bus stand traffic', 'Draft note', 'Hidden note']);
    expect(await titles({ status: 'draft' })).toEqual(['Draft note']);
    expect(await titles({ type: 'traffic' })).toEqual(['Bus stand traffic']);
    expect(await titles({ q: 'hid' })).toEqual(['Hidden note']);
    expect(await titles({ q: '.*' })).toEqual([]); // regex characters are escaped
    const one = await agent.get(`/api/v1/admin/news/${(await News.findOne({ title: 'Draft note' }))._id}`);
    expect(one.body.data).toMatchObject({ title: 'Draft note', status: 'draft', body: '' });
  });
});

describe('sample data', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });

  it('is refused in production and idempotent locally', async () => {
    const list = [
      { slug: 'sample-a', title: 'Sample A', summary: 'Sample summary text.', type: 'power', sourceName: 'Demo', validForHours: 5, categorySlug: 'civic' },
      { slug: 'sample-b', title: 'Sample B', summary: 'Sample summary text.', type: 'news', sourceName: 'Demo', status: 'draft' },
    ];
    const cats = new Map([['civic', civic._id]]);
    expect(await seedNews(list, cats)).toEqual({ created: 2, skipped: 0 });
    expect(await seedNews(list, cats)).toEqual({ created: 0, skipped: 2 });
    const { items } = await listPublic({ page: 1, limit: 5 });
    expect(items.map((n) => n.slug)).toEqual(['sample-a']);
    expect(items[0]).toMatchObject({ isSeed: true, category: { name: { en: 'Civic' } } });
    expect((await News.findOne({ slug: 'sample-b' }).lean()).publishedAt).toBeUndefined();
    process.env.NODE_ENV = 'production';
    resetEnvCache();
    await expect(seedNews(list, cats)).rejects.toThrow(/cannot be seeded in production/);
  });
});
