import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs, createBusiness } from '../../tests/factories.js';
import { Post, PostLike, PostComment, POST_LIMITS } from './community.model.js';
import { Report } from '../reports/reports.model.js';
import { User } from '../users/users.model.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const COVER = { url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/posts/p1.jpg', publicId: 'mana-tenali/posts/p1' };
const body = (o = {}) => ({ kind: 'recommendation', text: 'Try the gongura chicken at Padma meals, very fresh!', ...o });

describe('community posts', () => {
  it('signed-in users post; the feed is public, newest first, with author, business and counts', async () => {
    const biz = await createBusiness({ name: 'Padma Meals' });
    const a = await loginAs(app, 'user');
    const first = await a.agent.post('/api/v1/posts').send(body({ businessId: String(biz._id), area: 'Kothapeta', photo: COVER }));
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ kind: 'recommendation', area: 'Kothapeta', photo: COVER, business: { name: 'Padma Meals' }, author: { name: a.user.name }, likeCount: 0, commentCount: 0, isMine: true });
    await a.agent.post('/api/v1/posts').send(body({ kind: 'question', text: 'Where can I get my bicycle repaired?' }));
    const feed = await request(app).get('/api/v1/posts');
    expect(feed.body.data.map((p) => p.kind)).toEqual(['question', 'recommendation']);
    expect(feed.body.data[0]).toMatchObject({ isMine: false, likedByMe: false });
    expect(JSON.stringify(feed.body)).not.toMatch(/email|"status"|hiddenBy/);
    expect((await request(app).get('/api/v1/posts').query({ kind: 'question' })).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/posts').query({ area: 'Kothapeta' })).body.data).toHaveLength(1);
  });

  it('validates input, refuses server-owned fields, and needs sign-in; blocked users are refused', async () => {
    const { agent } = await loginAs(app, 'user');
    const bad = async (o) => (await agent.post('/api/v1/posts').send(body(o))).status;
    expect(await bad({ text: 'hi' })).toBe(400);
    expect(await bad({ text: 'x'.repeat(POST_LIMITS.textMax + 1) })).toBe(400);
    expect(await bad({ kind: 'advert' })).toBe(400);
    expect(await bad({ likeCount: 99 })).toBe(400);
    expect(await bad({ authorId: '64d0de0000000000000000aa' })).toBe(400);
    expect(await bad({ status: 'hidden' })).toBe(400);
    expect(await bad({ photo: { url: 'https://evil.example.com/x.jpg', publicId: 'mana-tenali/posts/x' } })).toBe(400);
    const hidden = await createBusiness({ status: 'hidden' });
    expect(await bad({ businessId: String(hidden._id) })).toBe(400);
    expect((await request(app).post('/api/v1/posts').set('Origin', TEST_ORIGIN).send(body())).status).toBe(401);
    const blocked = await loginAs(app, 'user');
    await User.updateOne({ _id: blocked.user._id }, { status: 'blocked' });
    expect((await blocked.agent.post('/api/v1/posts').send(body())).status).toBe(403);
    expect(await Post.countDocuments()).toBe(0);
  });

  it(`at most ${POST_LIMITS.perDay} posts per day per person`, async () => {
    const { agent, user } = await loginAs(app, 'user');
    await Post.insertMany(Array.from({ length: POST_LIMITS.perDay }, (_, i) => ({ authorId: user._id, kind: 'update', text: `Post number ${i}` })));
    expect((await agent.post('/api/v1/posts').send(body())).status).toBe(429);
  });

  it('authors edit and remove their own posts; others get 404; admins hide; hidden posts leave the feed', async () => {
    const a = await loginAs(app, 'user');
    const b = await loginAs(app, 'user');
    const { id } = (await a.agent.post('/api/v1/posts').send(body())).body.data;
    expect((await b.agent.patch(`/api/v1/posts/${id}`).send({ text: 'Hijacked text here' })).status).toBe(404);
    expect((await b.agent.delete(`/api/v1/posts/${id}`)).status).toBe(404);
    const edit = await a.agent.patch(`/api/v1/posts/${id}`).send({ text: 'Updated: the gongura chicken is excellent.' });
    expect(edit.body.data).toMatchObject({ text: 'Updated: the gongura chicken is excellent.' });
    expect(edit.body.data.editedAt).toBeTruthy();

    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.delete(`/api/v1/posts/${id}`)).body.data).toEqual({ id, status: 'hidden' });
    expect((await request(app).get(`/api/v1/posts/${id}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/posts')).body.data).toEqual([]);
    expect((await admin.agent.get(`/api/v1/posts/${id}`)).body.data.status).toBe('hidden'); // admins can still open it
    expect((await a.agent.patch(`/api/v1/posts/${id}`).send({ text: 'Trying to undo the hide' })).status).toBe(409);
    expect((await a.agent.get('/api/v1/posts/mine')).body.data[0].status).toBe('hidden');

    const second = (await a.agent.post('/api/v1/posts').send(body({ text: 'Another recommendation for you all' }))).body.data;
    expect((await a.agent.delete(`/api/v1/posts/${second.id}`)).body.data.status).toBe('removed');
    expect((await a.agent.get('/api/v1/posts/mine')).body.data.map((p) => p.id)).toEqual([id]); // removed posts are gone
  });
});

describe('likes and comments', () => {
  it('one like per person (idempotent); unlike; counts stay correct', async () => {
    const author = await loginAs(app, 'user');
    const { id } = (await author.agent.post('/api/v1/posts').send(body())).body.data;
    const fans = await Promise.all([1, 2].map(() => loginAs(app, 'user')));
    for (const f of fans) {
      expect((await f.agent.post(`/api/v1/posts/${id}/like`)).body.data.liked).toBe(true);
      expect((await f.agent.post(`/api/v1/posts/${id}/like`)).body.data.likeCount).toBe(fans.indexOf(f) + 1); // second like ignored
    }
    expect((await fans[0].agent.get(`/api/v1/posts/${id}`)).body.data).toMatchObject({ likeCount: 2, likedByMe: true });
    expect((await fans[0].agent.delete(`/api/v1/posts/${id}/like`)).body.data).toEqual({ liked: false, likeCount: 1 });
    expect((await fans[0].agent.delete(`/api/v1/posts/${id}/like`)).body.data.likeCount).toBe(1); // unliking twice changes nothing
    expect(await PostLike.countDocuments()).toBe(1);
    expect((await request(app).post(`/api/v1/posts/${id}/like`).set('Origin', TEST_ORIGIN)).status).toBe(401);
  });

  it('comments: add, list oldest first, delete own, admin hides; the count follows', async () => {
    const author = await loginAs(app, 'user');
    const { id } = (await author.agent.post('/api/v1/posts').send(body({ kind: 'question', text: 'Best tiffin centre near Bose Road?' }))).body.data;
    const c = await loginAs(app, 'user');
    const c1 = (await c.agent.post(`/api/v1/posts/${id}/comments`).send({ text: 'Annapurna, very good idlis.' })).body.data;
    const c2 = (await author.agent.post(`/api/v1/posts/${id}/comments`).send({ text: 'Thanks, will try!' })).body.data;
    expect((await c.agent.post(`/api/v1/posts/${id}/comments`).send({ text: '' })).status).toBe(400);
    const list = await request(app).get(`/api/v1/posts/${id}/comments`);
    expect(list.body.data.map((x) => x.text)).toEqual(['Annapurna, very good idlis.', 'Thanks, will try!']);
    expect((await request(app).get(`/api/v1/posts/${id}`)).body.data.commentCount).toBe(2);

    expect((await author.agent.delete(`/api/v1/comments/${c1.id}`)).status).toBe(404); // not the author of this comment
    expect((await c.agent.delete(`/api/v1/comments/${c1.id}`)).body.data.status).toBe('removed');
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.delete(`/api/v1/comments/${c2.id}`)).body.data.status).toBe('hidden');
    expect((await request(app).get(`/api/v1/posts/${id}/comments`)).body.data).toEqual([]);
    expect((await request(app).get(`/api/v1/posts/${id}`)).body.data.commentCount).toBe(0);
    expect(await PostComment.countDocuments()).toBe(2); // kept for the record
  });

  it('cannot like or comment on a hidden post', async () => {
    const author = await loginAs(app, 'user');
    const { id } = (await author.agent.post('/api/v1/posts').send(body())).body.data;
    await Post.updateOne({ _id: id }, { status: 'hidden' });
    const u = await loginAs(app, 'user');
    expect((await u.agent.post(`/api/v1/posts/${id}/like`)).status).toBe(404);
    expect((await u.agent.post(`/api/v1/posts/${id}/comments`).send({ text: 'Hello there' })).status).toBe(404);
  });
});

describe('reports, saved posts and uploads', () => {
  it('posts and comments can be reported; admins hide them from the queue and can block the author', async () => {
    const author = await loginAs(app, 'user');
    const { id } = (await author.agent.post('/api/v1/posts').send(body({ text: 'Buy cheap gold now, call me!!!' }))).body.data;
    const comment = (await author.agent.post(`/api/v1/posts/${id}/comments`).send({ text: 'Spam comment here' })).body.data;
    const reporter = await loginAs(app, 'user');
    expect((await reporter.agent.post('/api/v1/reports').send({ targetType: 'post', targetId: id, reason: 'spam' })).status).toBe(201);
    expect((await reporter.agent.post('/api/v1/reports').send({ targetType: 'comment', targetId: comment.id, reason: 'spam' })).status).toBe(201);
    const admin = await loginAs(app, 'admin');
    const queue = (await admin.agent.get('/api/v1/admin/reports')).body.data;
    expect(queue.map((r) => r.targetType).sort()).toEqual(['comment', 'post']);
    expect(queue.find((r) => r.targetType === 'post')).toMatchObject({ target: { isPublic: true }, responsibleUser: { email: author.user.email } });
    expect(queue.find((r) => r.targetType === 'comment').target).toMatchObject({ postId: id, isPublic: true });
    const postReport = queue.find((r) => r.targetType === 'post');
    expect((await admin.agent.patch(`/api/v1/admin/reports/${postReport.id}`).send({ action: 'hide_and_block' })).body.data.status).toBe('actioned');
    expect((await Post.findById(id).lean()).status).toBe('hidden');
    expect((await User.findById(author.user._id).lean()).status).toBe('blocked');
    expect(await Report.countDocuments({ status: 'open' })).toBe(1);
  });

  it('posts can be saved; hidden ones show as unavailable', async () => {
    const author = await loginAs(app, 'user');
    const { id } = (await author.agent.post('/api/v1/posts').send(body())).body.data;
    const u = await loginAs(app, 'user');
    expect((await u.agent.post('/api/v1/favorites').send({ targetType: 'post', targetId: id })).status).toBe(201);
    expect((await u.agent.get('/api/v1/favorites')).body.data[0]).toMatchObject({ targetType: 'post', item: { id, kind: 'recommendation' } });
    await Post.updateOne({ _id: id }, { status: 'hidden' });
    expect((await u.agent.get('/api/v1/favorites')).body.data[0].item).toBeNull();
  });

  it('any signed-in user can get a post photo upload signature', async () => {
    const { agent } = await loginAs(app, 'user');
    const res = await agent.post('/api/v1/media/sign').send({ purpose: 'post_photo' });
    expect(res.status).toBe(200);
    expect(res.body.data.params.folder).toBe('mana-tenali/posts');
  });

  it('uses indexes for the feed', async () => {
    await Post.init();
    const plan = await Post.find({ status: 'published' }).sort({ createdAt: -1 }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
  });
});
