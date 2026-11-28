import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs, createBusiness, createCategory, createUser } from '../../tests/factories.js';
import { News } from '../news/news.model.js';
import { Event } from '../events/events.model.js';
import { Offer } from '../offers/offers.model.js';
import { Business } from '../businesses/businesses.model.js';
import { Review } from '../reviews/reviews.model.js';
import { Post, PostComment, PostLike } from '../community/community.model.js';
import { Favorite } from '../favorites/favorites.model.js';
import { Report } from '../reports/reports.model.js';
import { User } from '../users/users.model.js';
import { ModerationAudit } from './audit.model.js';
import { releaseImages } from '../media/media.service.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const DAY = 86_400_000;
let seq = 0;
const news = (o = {}) =>
  News.create({
    title: `Water supply notice ${(seq += 1)}`, slug: `water-notice-${seq}`, summary: 'Supply will be off on Main Road.', type: 'news',
    sourceName: 'Municipal office', status: 'published', publishedAt: new Date(Date.now() - 60_000), ...o,
  });
const offer = (business, o = {}) =>
  Offer.create({
    businessId: business._id, title: `Festival offer ${(seq += 1)}`, discountLabel: '10% off', terms: 'Terms apply.',
    validFrom: new Date(Date.now() - DAY), validTo: new Date(Date.now() + 3 * DAY), status: 'published', ...o,
  });
const event = async (o = {}) => {
  const cat = await createCategory({ type: 'event', slug: `ev-${(seq += 1)}` });
  return Event.create({
    title: `Temple festival ${seq}`, slug: `temple-festival-${seq}`, categoryId: cat._id, organizerName: 'Temple trust',
    venue: { name: 'Temple', address: 'Bose Road', area: 'Bose Road' }, startAt: new Date(Date.now() + DAY),
    endAt: new Date(Date.now() + DAY + 3_600_000), status: 'published', ...o,
  });
};
const img = (folder, name) => ({ url: `https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/${folder}/${name}.jpg`, publicId: `mana-tenali/${folder}/${name}` });

const mod = (agent, type, id) => ({
  get: () => agent.get(`/api/v1/admin/moderation/${type}/${id}`),
  archive: (body = {}) => agent.post(`/api/v1/admin/moderation/${type}/${id}/archive`).send(body),
  restore: () => agent.post(`/api/v1/admin/moderation/${type}/${id}/restore`).send({}),
  delete: (body = { confirm: true }) => agent.delete(`/api/v1/admin/moderation/${type}/${id}`).send(body),
});

describe('admin moderation: archive, restore, delete (news article)', () => {
  it('archive hides it everywhere public (404 on its URL), keeps the record, and restore brings it back', async () => {
    const n = await news({ title: 'Gongura festival announced' });
    const admin = await loginAs(app, 'admin');
    const publicList = async () => (await request(app).get('/api/v1/news')).body.data.map((x) => x.slug);

    expect(await publicList()).toEqual([n.slug]);
    const archived = await mod(admin.agent, 'news', n._id).archive({ reason: 'Wrong date in the article' });
    expect(archived.status).toBe(200);
    expect(archived.body.data).toMatchObject({ type: 'news', id: String(n._id), moderationStatus: 'archived', moderationReason: 'Wrong date in the article', archivedBy: admin.user.name });

    // Gone from public pages, search, home and its own URL; the record and its content are kept.
    expect(await publicList()).toEqual([]);
    expect((await request(app).get(`/api/v1/news/${n.slug}`)).status).toBe(404);
    expect(JSON.stringify((await request(app).get('/api/v1/search').query({ q: 'Gongura' })).body)).not.toContain('Gongura festival');
    expect(JSON.stringify((await request(app).get('/api/v1/home')).body)).not.toContain('Gongura festival');
    const stored = await News.findById(n._id).lean();
    expect(stored).toMatchObject({ title: 'Gongura festival announced', status: 'hidden', moderation: { reason: 'Wrong date in the article', previousStatus: 'published' } });
    expect((await mod(admin.agent, 'news', n._id).archive()).status).toBe(409); // already archived

    // In the dashboard's archived list
    const list = await admin.agent.get('/api/v1/admin/moderation').query({ type: 'news', status: 'archived' });
    expect(list.body.data.map((r) => r.id)).toEqual([String(n._id)]);
    expect(list.body.meta).toMatchObject({ total: 1 });

    const restored = await mod(admin.agent, 'news', n._id).restore();
    expect(restored.body.data).toMatchObject({ moderationStatus: 'published', status: 'published', archivedAt: null });
    expect(await publicList()).toEqual([n.slug]);
    expect((await request(app).get(`/api/v1/news/${n.slug}`)).status).toBe(200);
    expect((await News.findById(n._id).lean()).moderation).toBeUndefined();
    expect((await mod(admin.agent, 'news', n._id).restore()).status).toBe(409); // not archived

    const audit = (await admin.agent.get('/api/v1/admin/moderation/audit')).body.data;
    expect(audit.map((a) => a.action)).toEqual(['restore', 'archive']);
    expect(audit[1]).toMatchObject({ contentType: 'news', contentId: String(n._id), reason: 'Wrong date in the article', admin: admin.user.name, title: 'Gongura festival announced' });
  });

  it('delete permanently needs explicit confirmation, removes the record and is logged', async () => {
    const n = await news();
    const admin = await loginAs(app, 'admin');
    expect((await mod(admin.agent, 'news', n._id).delete({})).status).toBe(400);
    expect((await mod(admin.agent, 'news', n._id).delete({ confirm: 'yes' })).status).toBe(400);
    expect(await News.exists({ _id: n._id })).toBeTruthy();

    const res = await mod(admin.agent, 'news', n._id).delete({ confirm: true, reason: 'Duplicate' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ type: 'news', id: String(n._id), deleted: true });
    expect(await News.exists({ _id: n._id })).toBeNull();
    expect((await request(app).get(`/api/v1/news/${n.slug}`)).status).toBe(404);
    expect((await admin.agent.get('/api/v1/admin/moderation').query({ type: 'news' })).body.data).toEqual([]);
    expect((await mod(admin.agent, 'news', n._id).delete()).status).toBe(404);
    expect(await ModerationAudit.findOne({ action: 'delete' }).lean()).toMatchObject({ contentType: 'news', reason: 'Duplicate', title: n.title });
  });
});

describe('admin moderation: authorization (server-side, role from the database)', () => {
  it('visitors get 401; users and owners get 403 on every moderation endpoint, even for their own content', async () => {
    const owner = await loginAs(app, 'owner');
    const biz = await createBusiness({ ownerId: owner.user._id });
    const author = await loginAs(app, 'user');
    const post = await Post.create({ authorId: author.user._id, kind: 'update', text: 'My own post about the market' });

    for (const [type, id] of [['business', biz._id], ['post', post._id]]) {
      const anon = mod(request(app), type, id);
      expect((await anon.get()).status).toBe(401);
      expect((await request(app).post(`/api/v1/admin/moderation/${type}/${id}/archive`).set('Origin', TEST_ORIGIN).send({})).status).toBe(401);
      expect((await request(app).delete(`/api/v1/admin/moderation/${type}/${id}`).set('Origin', TEST_ORIGIN).send({ confirm: true })).status).toBe(401);
      for (const who of [owner, author]) {
        const m = mod(who.agent, type, id);
        expect((await m.get()).status).toBe(403);
        expect((await m.archive()).status).toBe(403);
        expect((await m.restore()).status).toBe(403);
        expect((await m.delete()).status).toBe(403);
      }
    }
    expect((await author.agent.get('/api/v1/admin/moderation').query({ type: 'post' })).status).toBe(403);
    expect((await author.agent.get('/api/v1/admin/moderation/audit')).status).toBe(403);
    expect(await Business.findById(biz._id).lean()).toMatchObject({ status: 'published' });
    expect(await Post.findById(post._id).lean()).toMatchObject({ status: 'published' });
    expect(await ModerationAudit.countDocuments()).toBe(0);
  });

  it('a role sent by the client is ignored; users cannot make themselves admin', async () => {
    const u = await loginAs(app, 'user');
    expect((await u.agent.patch('/api/v1/users/me').send({ role: 'admin' })).status).toBe(400);
    expect((await u.agent.patch('/api/v1/admin/users/' + u.user._id).send({ role: 'admin' })).status).toBe(403);
    expect((await User.findById(u.user._id).lean()).role).toBe('user');
    const n = await news();
    expect((await u.agent.post(`/api/v1/admin/moderation/news/${n._id}/archive`).set('X-Role', 'admin').send({ role: 'admin' })).status).toBe(403);
    // Demoted admins lose access on their next request.
    const admin = await loginAs(app, 'admin');
    await User.updateOne({ _id: admin.user._id }, { role: 'user' });
    expect((await mod(admin.agent, 'news', n._id).archive()).status).toBe(403);
  });

  it('validates the type, the id and the payload', async () => {
    const admin = await loginAs(app, 'admin');
    const n = await news();
    expect((await admin.agent.post(`/api/v1/admin/moderation/user/${admin.user._id}/archive`).send({})).status).toBe(400);
    expect((await admin.agent.post('/api/v1/admin/moderation/news/not-an-id/archive').send({})).status).toBe(400);
    expect((await mod(admin.agent, 'news', n._id).archive({ reason: 'x'.repeat(501) })).status).toBe(400);
    expect((await mod(admin.agent, 'news', n._id).archive({ status: 'published' })).status).toBe(400);
    expect((await admin.agent.post(`/api/v1/admin/moderation/news/${n._id}/restore`).send({ status: 'published' })).status).toBe(400);
    expect((await mod(admin.agent, 'news', '64d0de0000000000000000aa').archive()).status).toBe(404);
    expect((await admin.agent.get('/api/v1/admin/moderation').query({ type: 'everything' })).status).toBe(400);
  });

  it('normal create and update endpoints cannot set or clear moderation data', async () => {
    const u = await loginAs(app, 'user');
    const created = await u.agent.post('/api/v1/posts').send({ kind: 'update', text: 'Road repairs near the bus stand', moderation: { archivedAt: null } });
    expect(created.status).toBe(400);
    const post = await Post.create({ authorId: u.user._id, kind: 'update', text: 'Road repairs near the bus stand' });
    const admin = await loginAs(app, 'admin');
    await mod(admin.agent, 'post', post._id).archive();
    expect((await u.agent.patch(`/api/v1/posts/${post._id}`).send({ text: 'Undo the archive please' })).status).toBe(409);
    expect((await u.agent.patch(`/api/v1/posts/${post._id}`).send({ status: 'published' })).status).toBe(400);
    expect((await Post.findById(post._id).lean()).status).toBe('hidden');
  });
});

describe('admin moderation: each content type', () => {
  it('business: archive removes it (and its offers) from lists, search, home and its URL; the owner cannot undo it', async () => {
    const owner = await loginAs(app, 'owner');
    const biz = await createBusiness({ name: 'Sri Padma Sweets', ownerId: owner.user._id });
    const o = await offer(biz, { title: 'Sweet box deal' });
    const admin = await loginAs(app, 'admin');
    expect((await mod(admin.agent, 'business', biz._id).archive({ reason: 'Closed down' })).body.data.moderationStatus).toBe('archived');

    expect((await request(app).get('/api/v1/businesses')).body.data).toEqual([]);
    expect((await request(app).get(`/api/v1/businesses/${biz.slug}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/offers')).body.data).toEqual([]);
    expect((await request(app).get(`/api/v1/offers/${o._id}`)).status).toBe(404);
    const search = JSON.stringify((await request(app).get('/api/v1/search').query({ q: 'Padma' })).body);
    expect(search).not.toContain('Sri Padma Sweets');
    expect(JSON.stringify((await request(app).get('/api/v1/home')).body)).not.toContain('Sri Padma Sweets');
    // The owner's edit endpoint cannot change the status back.
    expect((await owner.agent.patch(`/api/v1/businesses/${biz._id}`).send({ status: 'published' })).status).toBe(400);
    expect((await Business.findById(biz._id).lean()).status).toBe('hidden');

    await mod(admin.agent, 'business', biz._id).restore();
    expect((await request(app).get('/api/v1/businesses')).body.data.map((b) => b.name)).toEqual(['Sri Padma Sweets']);
    expect((await request(app).get(`/api/v1/offers/${o._id}`)).status).toBe(200);
  });

  it('offer: archived offers leave the feed; the owner cannot publish them again; restore respects the rules', async () => {
    const owner = await loginAs(app, 'owner');
    const biz = await createBusiness({ ownerId: owner.user._id });
    const o = await offer(biz, { title: 'Diwali discount' });
    const admin = await loginAs(app, 'admin');
    await mod(admin.agent, 'offer', o._id).archive({ reason: 'Misleading' });
    expect((await request(app).get('/api/v1/offers')).body.data).toEqual([]);
    expect((await request(app).get(`/api/v1/offers/${o._id}`)).status).toBe(404);
    const republish = await owner.agent.patch(`/api/v1/offers/${o._id}`).send({ status: 'published' });
    expect(republish.status).toBe(409);
    expect((await Offer.findById(o._id).lean()).status).toBe('hidden');
    await mod(admin.agent, 'offer', o._id).restore();
    expect((await request(app).get('/api/v1/offers')).body.data.map((x) => x.title)).toEqual(['Diwali discount']);
  });

  it('event: archive and restore go into the event history; archived events are 404', async () => {
    const e = await event({ title: 'Kite festival' });
    const admin = await loginAs(app, 'admin');
    await mod(admin.agent, 'event', e._id).archive({ reason: 'Postponed' });
    expect((await request(app).get(`/api/v1/events/${e.slug}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/events')).body.data).toEqual([]);
    await mod(admin.agent, 'event', e._id).restore();
    expect((await request(app).get(`/api/v1/events/${e.slug}`)).status).toBe(200);
    const log = (await Event.findById(e._id).lean()).moderationLog.map((l) => [l.action, l.toStatus]);
    expect(log).toEqual([['hidden', 'hidden'], ['restored', 'published']]);
  });

  it('review: archive takes it out of the rating and the business page; restore puts it back', async () => {
    const biz = await createBusiness();
    const u = await createUser();
    const r = await Review.create({ businessId: biz._id, userId: u._id, rating: 1, comment: 'Rude staff' });
    await Review.create({ businessId: biz._id, userId: (await createUser())._id, rating: 5 });
    const admin = await loginAs(app, 'admin');
    await admin.agent.post(`/api/v1/admin/moderation/review/${r._id}/archive`).send({});
    expect((await request(app).get(`/api/v1/businesses/${biz._id}/reviews`)).body.data.map((x) => x.rating)).toEqual([5]);
    expect(await Business.findById(biz._id).lean()).toMatchObject({ ratingAvg: 5, ratingCount: 1 });
    await mod(admin.agent, 'review', r._id).restore();
    expect(await Business.findById(biz._id).lean()).toMatchObject({ ratingAvg: 3, ratingCount: 2 });
  });

  it('post and comment: archive / restore keep the comment count right; deleting a post removes its likes and comments', async () => {
    const u = await loginAs(app, 'user');
    const post = await Post.create({ authorId: u.user._id, kind: 'question', text: 'Best idli in Kothapeta?', commentCount: 1 });
    const c = await PostComment.create({ postId: post._id, authorId: u.user._id, text: 'Try Ravi tiffins' });
    await PostLike.create({ postId: post._id, userId: u.user._id });
    const admin = await loginAs(app, 'admin');

    await mod(admin.agent, 'comment', c._id).archive();
    expect((await Post.findById(post._id).lean()).commentCount).toBe(0);
    expect((await request(app).get(`/api/v1/posts/${post._id}/comments`)).body.data).toEqual([]);
    await mod(admin.agent, 'comment', c._id).restore();
    expect((await Post.findById(post._id).lean()).commentCount).toBe(1);

    await mod(admin.agent, 'post', post._id).archive();
    expect((await request(app).get('/api/v1/posts')).body.data).toEqual([]);
    expect((await request(app).get(`/api/v1/posts/${post._id}`)).status).toBe(404);

    const del = await mod(admin.agent, 'post', post._id).delete();
    expect(del.body.data.related).toMatchObject({ comments: 1 });
    expect(await Post.exists({ _id: post._id })).toBeNull();
    expect(await PostComment.countDocuments()).toBe(0);
    expect(await PostLike.countDocuments()).toBe(0);
  });

  it('report "hide" archives through moderation, so it can be restored and is in the audit log', async () => {
    const u = await loginAs(app, 'user');
    const post = await Post.create({ authorId: (await createUser())._id, kind: 'update', text: 'Spam spam spam buy now' });
    const report = (await u.agent.post('/api/v1/reports').send({ targetType: 'post', targetId: String(post._id), reason: 'spam' })).body.data;
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.patch(`/api/v1/admin/reports/${report.id}`).send({ action: 'hide_target', note: 'Spam' })).status).toBe(200);
    expect((await mod(admin.agent, 'post', post._id).get()).body.data).toMatchObject({ moderationStatus: 'archived', moderationReason: 'Spam' });
    expect(await ModerationAudit.findOne().lean()).toMatchObject({ action: 'archive', source: 'report', contentType: 'post' });
    expect((await mod(admin.agent, 'post', post._id).restore()).body.data.moderationStatus).toBe('published');
  });
});

describe('admin moderation: permanent delete of a business', () => {
  it('removes its offers, reviews and saves, closes reports, unlinks events and posts, and deletes only unused images', async () => {
    const shared = img('businesses', 'shared');
    const biz = await createBusiness({ name: 'Old Bakery', photos: [img('businesses', 'own'), shared] });
    const other = await createBusiness({ name: 'Other Bakery', photos: [shared] });
    const o = await offer(biz, { image: img('offers', 'o1') });
    const keepOffer = await offer(other);
    const u = await loginAs(app, 'user');
    const r = await Review.create({ businessId: biz._id, userId: u.user._id, rating: 4 });
    await Favorite.create({ userId: u.user._id, targetType: 'business', targetId: biz._id });
    await Favorite.create({ userId: u.user._id, targetType: 'offer', targetId: o._id });
    await Favorite.create({ userId: u.user._id, targetType: 'business', targetId: other._id });
    await Report.create({ reporterId: u.user._id, targetType: 'review', targetId: r._id, reason: 'spam' });
    await Report.create({ reporterId: u.user._id, targetType: 'business', targetId: biz._id, reason: 'closed' });
    const e = await event({ businessId: biz._id });
    const p = await Post.create({ authorId: u.user._id, kind: 'recommendation', text: 'Loved the bakery buns', businessId: biz._id });

    const destroyed = [];
    vi.stubGlobal('fetch', async (url, init) => {
      if (String(url).includes('/image/destroy')) destroyed.push(new URLSearchParams(init.body).get('public_id'));
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
    });
    try {
      const admin = await loginAs(app, 'admin');
      const res = await mod(admin.agent, 'business', biz._id).delete({ confirm: true, reason: 'Spam listing' });
      expect(res.status).toBe(200);
      expect(res.body.data.related).toMatchObject({ offers: 1, reviews: 1, saves: 2, reportsClosed: 2 });
      expect(res.body.data.images).toMatchObject({ removed: 2, failed: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(destroyed.sort()).toEqual(['mana-tenali/businesses/own', 'mana-tenali/offers/o1']); // the shared photo stays

    expect(await Business.exists({ _id: biz._id })).toBeNull();
    expect(await Offer.exists({ _id: o._id })).toBeNull();
    expect(await Review.exists({ _id: r._id })).toBeNull();
    expect(await Favorite.countDocuments()).toBe(1);
    expect(await Report.countDocuments({ status: 'actioned', 'resolution.action': 'content_deleted' })).toBe(2);
    expect((await Event.findById(e._id).lean()).businessId).toBeUndefined();
    expect(await Post.findById(p._id).lean()).toMatchObject({ text: 'Loved the bakery buns', status: 'published' });
    // Unrelated data is untouched.
    expect(await Business.exists({ _id: other._id })).toBeTruthy();
    expect(await Offer.exists({ _id: keepOffer._id })).toBeTruthy();
    expect(await User.exists({ _id: u.user._id })).toBeTruthy();
    expect(await ModerationAudit.findOne({ action: 'delete' }).lean()).toMatchObject({ contentType: 'business', title: 'Old Bakery', related: { offers: 1, reviews: 1, imagesDeleted: 2 } });
  });

  it('image release only touches this project\'s public folders', async () => {
    const destroy = vi.fn(async () => true);
    const out = await releaseImages(['mana-tenali/posts/a', 'mana-tenali/evidence/u_1/x', 'other/folder/b', '../mana-tenali/posts/c', 'mana-tenali/posts/a'], { destroy });
    expect(destroy.mock.calls.map(([a]) => a.publicId)).toEqual(['mana-tenali/posts/a']);
    expect(out).toMatchObject({ removed: 1, failed: 0 });
  });
});

describe('admin moderation dashboard list', () => {
  it('lists any status, filters by status, title and author, and paginates', async () => {
    const alice = await createUser({ name: 'Alice Rao', email: 'alice@example.com' });
    const bob = await createUser({ name: 'Bob Kumar' });
    for (let i = 0; i < 3; i += 1) await Post.create({ authorId: alice._id, kind: 'update', text: `Alice market update ${i}` });
    const bobPost = await Post.create({ authorId: bob._id, kind: 'question', text: 'Bob asks about bus timings' });
    const admin = await loginAs(app, 'admin');
    await mod(admin.agent, 'post', bobPost._id).archive({ reason: 'Off topic' });
    const list = (q) => admin.agent.get('/api/v1/admin/moderation').query({ type: 'post', ...q });

    const all = await list();
    expect(all.body.meta.total).toBe(4);
    expect(all.body.data[0]).toMatchObject({ type: 'post', author: { name: expect.any(String), email: expect.any(String) } });
    expect((await list({ status: 'published' })).body.meta.total).toBe(3);
    const archived = (await list({ status: 'archived' })).body.data;
    expect(archived).toHaveLength(1);
    expect(archived[0]).toMatchObject({ title: 'Bob asks about bus timings', author: { name: 'Bob Kumar' }, moderationReason: 'Off topic', archivedBy: admin.user.name });
    expect((await list({ author: 'alice@example' })).body.meta.total).toBe(3);
    expect((await list({ author: String(bob._id) })).body.meta.total).toBe(1);
    expect((await list({ author: 'nobody-matches' })).body.data).toEqual([]);
    expect((await list({ q: 'bus' })).body.meta.total).toBe(1);
    const page2 = await list({ limit: 3, page: 2 });
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.meta).toMatchObject({ page: 2, total: 4 });
  });

  it('public responses never carry moderation data', async () => {
    const n = await news({ title: 'Power cut on Tuesday' });
    const admin = await loginAs(app, 'admin');
    await mod(admin.agent, 'news', n._id).archive({ reason: 'internal note 123' });
    await mod(admin.agent, 'news', n._id).restore();
    const body = JSON.stringify([(await request(app).get('/api/v1/news')).body, (await request(app).get(`/api/v1/news/${n.slug}`)).body]);
    expect(body).not.toMatch(/moderation|archivedBy|internal note/);
  });
});
