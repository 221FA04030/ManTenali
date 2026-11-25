import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs, createBusiness, createUser } from '../../tests/factories.js';
import { Business } from '../businesses/businesses.model.js';
import { Review } from './reviews.model.js';
import { recalculateRating } from './reviews.service.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const rating = async (id) => {
  const b = await Business.findById(id).lean();
  return { avg: b.ratingAvg, count: b.ratingCount };
};

describe('writing reviews (FR-REV-1)', () => {
  it('one review per user per business; rating recalculated; the listing does not look "updated"', async () => {
    const biz = await createBusiness({ name: 'Padma Meals' });
    const before = (await Business.findById(biz._id).lean()).updatedAt;
    const a = await loginAs(app, 'user');
    const res = await a.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 5, comment: 'Lovely meals.' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ rating: 5, comment: 'Lovely meals.', status: 'published', author: { name: a.user.name } });
    expect(await rating(biz._id)).toEqual({ avg: 5, count: 1 });
    expect((await Business.findById(biz._id).lean()).updatedAt.getTime()).toBe(before.getTime());

    expect((await a.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 3 })).status).toBe(409);
    const b = await loginAs(app, 'owner');
    await b.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 4 });
    const c = await loginAs(app, 'admin');
    await c.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 4 });
    expect(await rating(biz._id)).toEqual({ avg: 4.3, count: 3 }); // (5+4+4)/3 rounded to one decimal
  });

  it('owners cannot review their own business; only published businesses; sign-in required; blocked users refused', async () => {
    const owner = await loginAs(app, 'owner');
    const mine = await createBusiness({ ownerId: owner.user._id });
    expect((await owner.agent.post(`/api/v1/businesses/${mine._id}/reviews`).send({ rating: 5 })).status).toBe(403);
    const hidden = await createBusiness({ status: 'hidden' });
    const u = await loginAs(app, 'user');
    expect((await u.agent.post(`/api/v1/businesses/${hidden._id}/reviews`).send({ rating: 5 })).status).toBe(404);
    expect((await request(app).get(`/api/v1/businesses/${hidden._id}/reviews`)).status).toBe(404);
    const open = await createBusiness();
    expect((await request(app).post(`/api/v1/businesses/${open._id}/reviews`).set('Origin', TEST_ORIGIN).send({ rating: 5 })).status).toBe(401);
    const blocked = await loginAs(app, 'user');
    const { User } = await import('../users/users.model.js');
    await User.updateOne({ _id: blocked.user._id }, { status: 'blocked' });
    expect((await blocked.agent.post(`/api/v1/businesses/${open._id}/reviews`).send({ rating: 5 })).status).toBe(403);
    expect(await Review.countDocuments()).toBe(0);
  });

  it('validates rating (whole 1-5), comment length and rejects server-owned fields', async () => {
    const biz = await createBusiness();
    const { agent } = await loginAs(app, 'user');
    const post = (body) => agent.post(`/api/v1/businesses/${biz._id}/reviews`).send(body);
    for (const body of [{}, { rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: '5' }, { rating: 5, comment: 'x'.repeat(1001) }, { rating: 5, userId: String(biz._id) }, { rating: 5, status: 'hidden' }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect((await agent.post('/api/v1/businesses/not-an-id/reviews').send({ rating: 5 })).status).toBe(400);
  });
});

describe('reading reviews', () => {
  it('lists published reviews newest first with author names, paginated; hidden reviews are left out', async () => {
    const biz = await createBusiness();
    const users = await Promise.all([1, 2, 3].map(() => createUser()));
    const t = Date.now();
    await Review.create({ businessId: biz._id, userId: users[0]._id, rating: 3, comment: 'Old', createdAt: new Date(t - 3000) });
    await Review.create({ businessId: biz._id, userId: users[1]._id, rating: 4, comment: 'New', createdAt: new Date(t - 1000) });
    await Review.create({ businessId: biz._id, userId: users[2]._id, rating: 1, comment: 'Hidden', status: 'hidden' });
    const res = await request(app).get(`/api/v1/businesses/${biz._id}/reviews`).query({ limit: 1, page: 1 });
    expect(res.body.data.map((r) => r.comment)).toEqual(['New']);
    expect(res.body.data[0].author).toEqual({ id: String(users[1]._id), name: users[1].name, avatarUrl: null });
    expect(res.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    expect(JSON.stringify(res.body)).not.toMatch(/email|"status"|hiddenBy/);
  });

  it('my review of a business (any status) and all my reviews on the profile (FR-PRO-2)', async () => {
    const biz = await createBusiness({ name: 'Kirana' });
    const gone = await createBusiness({ name: 'Gone' });
    const me = await loginAs(app, 'user');
    expect((await me.agent.get(`/api/v1/businesses/${biz._id}/reviews/mine`)).body.data).toBeNull();
    await me.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 4 });
    await me.agent.post(`/api/v1/businesses/${gone._id}/reviews`).send({ rating: 2 });
    await Business.updateOne({ _id: gone._id }, { status: 'archived' });
    expect((await me.agent.get(`/api/v1/businesses/${biz._id}/reviews/mine`)).body.data).toMatchObject({ rating: 4, status: 'published' });
    const mine = (await me.agent.get('/api/v1/reviews/mine')).body.data;
    expect(mine.map((r) => [r.rating, r.business?.name ?? null]).sort()).toEqual([[2, null], [4, 'Kirana']]);
    expect((await request(app).get('/api/v1/reviews/mine')).status).toBe(401);
  });
});

describe('editing, deleting and hiding', () => {
  it('authors edit and delete their own review (rating recalculated); others get 404', async () => {
    const biz = await createBusiness();
    const me = await loginAs(app, 'user');
    const other = await loginAs(app, 'user');
    const { id } = (await me.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 2 })).body.data;
    await other.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 4 });
    expect(await rating(biz._id)).toEqual({ avg: 3, count: 2 });

    expect((await other.agent.patch(`/api/v1/reviews/${id}`).send({ rating: 1 })).status).toBe(404);
    expect((await other.agent.delete(`/api/v1/reviews/${id}`)).status).toBe(404);
    const edit = await me.agent.patch(`/api/v1/reviews/${id}`).send({ rating: 5, comment: 'Better now.' });
    expect(edit.body.data).toMatchObject({ rating: 5, comment: 'Better now.' });
    expect(await rating(biz._id)).toEqual({ avg: 4.5, count: 2 });
    expect((await me.agent.patch(`/api/v1/reviews/${id}`).send({})).status).toBe(400);

    expect((await me.agent.delete(`/api/v1/reviews/${id}`)).body.data).toEqual({ id, deleted: true });
    expect(await Review.exists({ _id: id })).toBeNull(); // the author's own deletion is permanent (D9.3)
    expect(await rating(biz._id)).toEqual({ avg: 4, count: 1 });
    // ...and they may review again
    expect((await me.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 3 })).status).toBe(201);
  });

  it('admins hide any review (kept, rating recalculated); the author can no longer edit it', async () => {
    const biz = await createBusiness();
    const author = await loginAs(app, 'user');
    const { id } = (await author.agent.post(`/api/v1/businesses/${biz._id}/reviews`).send({ rating: 1, comment: 'Rude words' })).body.data;
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.delete(`/api/v1/reviews/${id}`)).body.data).toEqual({ id, status: 'hidden' });
    expect(await Review.findById(id).lean()).toMatchObject({ status: 'hidden', hiddenBy: admin.user._id });
    expect(await rating(biz._id)).toEqual({ avg: 0, count: 0 });
    expect((await request(app).get(`/api/v1/businesses/${biz._id}/reviews`)).body.data).toEqual([]);
    expect((await author.agent.patch(`/api/v1/reviews/${id}`).send({ rating: 5 })).status).toBe(409);
    expect((await author.agent.get(`/api/v1/businesses/${biz._id}/reviews/mine`)).body.data.status).toBe('hidden');
    expect((await admin.agent.delete('/api/v1/reviews/64d0de0000000000000000aa')).status).toBe(404);
  });

  it('rating math: average of published reviews to one decimal; none -> 0', async () => {
    const biz = await createBusiness();
    const users = await Promise.all([1, 2, 3].map(() => createUser()));
    for (const [i, r] of [5, 4, 2].entries()) await Review.create({ businessId: biz._id, userId: users[i]._id, rating: r });
    expect(await recalculateRating(biz._id)).toEqual({ avg: 3.7, count: 3 });
    await Review.deleteMany({});
    expect(await recalculateRating(biz._id)).toEqual({ avg: 0, count: 0 });
  });

  it('uses indexes: unique (businessId, userId) and the public list', async () => {
    await Review.init();
    const indexes = await Review.collection.indexes();
    expect(indexes.find((i) => Object.keys(i.key).join(',') === 'businessId,userId')).toMatchObject({ unique: true });
    const plan = await Review.find({ businessId: '64d0de0000000000000000aa', status: 'published' }).sort({ createdAt: -1 }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
  });
});
