import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs, createUser } from '../../tests/factories.js';
import { User } from './users.model.js';
import { upsertAdmin, verifyPassword } from './users.service.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe('PATCH /users/me', () => {
  it('updates name, area and language', async () => {
    const { agent } = await loginAs(app);
    const res = await agent
      .patch('/api/v1/users/me')
      .send({ name: 'Lakshmi', preferredArea: 'Bose Road', language: 'te' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Lakshmi', preferredArea: 'Bose Road', language: 'te' });
  });

  it('clears the area with null', async () => {
    const { agent } = await loginAs(app, 'user', { preferredArea: 'Kothapeta' });
    const res = await agent.patch('/api/v1/users/me').send({ preferredArea: null });
    expect(res.status).toBe(200);
    expect(res.body.data.preferredArea).toBeNull();
  });

  it('cannot change role, status or email', async () => {
    const { agent, user } = await loginAs(app);
    const res = await agent.patch('/api/v1/users/me').send({ role: 'admin', status: 'active' });
    expect(res.status).toBe(400);
    expect((await User.findById(user._id).lean()).role).toBe('user');
  });

  it('rejects invalid values', async () => {
    const { agent } = await loginAs(app);
    const res = await agent.patch('/api/v1/users/me').send({ language: 'fr', avatarUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('accepts avatars only from the project Cloudinary avatars folder', async () => {
    const { agent } = await loginAs(app);
    const good = 'https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/avatars/me.jpg';
    const ok = await agent.patch('/api/v1/users/me').send({ avatarUrl: good });
    expect(ok.status).toBe(200);
    expect(ok.body.data.avatarUrl).toBe(good);
    const external = await agent.patch('/api/v1/users/me').send({ avatarUrl: 'https://example.com/me.jpg' });
    expect(external.status).toBe(400);
    const cleared = await agent.patch('/api/v1/users/me').send({ avatarUrl: null });
    expect(cleared.body.data.avatarUrl).toBeNull();
  });

  it('requires login', async () => {
    const res = await request(app).patch('/api/v1/users/me').set('Origin', TEST_ORIGIN).send({ name: 'Anon' });
    expect(res.status).toBe(401);
  });
});

describe('admin user management', () => {
  it('lists and searches users (admin only)', async () => {
    const { agent } = await loginAs(app, 'admin');
    await createUser({ name: 'Sita Devi', email: 'sita@example.com' });
    const res = await agent.get('/api/v1/admin/users').query({ q: 'sita' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ name: 'Sita Devi', signIn: ['password'] });
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2b\$/);
  });

  it('forbids non-admins', async () => {
    for (const role of ['user', 'owner']) {
      const { agent } = await loginAs(app, role);
      expect((await agent.get('/api/v1/admin/users')).status).toBe(403);
    }
    expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);
  });

  it('changes roles and blocks users', async () => {
    const { agent } = await loginAs(app, 'admin');
    const target = await createUser();
    const res = await agent.patch(`/api/v1/admin/users/${target._id}`).send({ role: 'owner' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('owner');
    const blocked = await agent.patch(`/api/v1/admin/users/${target._id}`).send({ status: 'blocked' });
    expect(blocked.body.data.status).toBe('blocked');
  });

  it('prevents admins from demoting or blocking themselves', async () => {
    const { agent, user } = await loginAs(app, 'admin');
    const res = await agent.patch(`/api/v1/admin/users/${user._id}`).send({ role: 'user' });
    expect(res.status).toBe(403);
    const res2 = await agent.patch(`/api/v1/admin/users/${user._id}`).send({ status: 'blocked' });
    expect(res2.status).toBe(403);
  });

  it('validates ids and payloads; 404 for unknown users', async () => {
    const { agent } = await loginAs(app, 'admin');
    expect((await agent.patch('/api/v1/admin/users/not-an-id').send({ role: 'owner' })).status).toBe(400);
    expect((await agent.patch('/api/v1/admin/users/64b000000000000000000000').send({ role: 'owner' })).status).toBe(404);
    const target = await createUser();
    expect((await agent.patch(`/api/v1/admin/users/${target._id}`).send({ role: 'superuser' })).status).toBe(400);
    expect((await agent.patch(`/api/v1/admin/users/${target._id}`).send({})).status).toBe(400);
  });
});

describe('upsertAdmin (seed:admin)', () => {
  it('creates an admin, and re-running updates the password without duplicating', async () => {
    const a = await upsertAdmin({ email: 'Admin@Example.com', password: 'first-password-123' });
    expect(a).toMatchObject({ email: 'admin@example.com', role: 'admin' });
    await upsertAdmin({ email: 'admin@example.com', password: 'second-password-456' });
    const users = await User.find({ email: 'admin@example.com' }).select('+passwordHash').lean();
    expect(users).toHaveLength(1);
    expect(await verifyPassword('second-password-456', users[0].passwordHash)).toBe(true);
  });

  it('promotes an existing user to admin', async () => {
    const user = await createUser({ email: 'promote@example.com' });
    await upsertAdmin({ email: 'promote@example.com', password: 'a-strong-password-1' });
    expect((await User.findById(user._id).lean()).role).toBe('admin');
  });
});

describe('/users/me/engagement (Home shortcut ranking)', () => {
  const at = (minsAgo) => new Date(Date.now() - minsAgo * 60_000).toISOString();

  it('needs a session', async () => {
    expect((await request(app).get('/api/v1/users/me/engagement')).status).toBe(401);
    const res = await request(app).patch('/api/v1/users/me/engagement').set('Origin', TEST_ORIGIN).send({ features: {} });
    expect(res.status).toBe(401);
  });

  it('starts empty, saves, and keeps the newest entry per feature', async () => {
    const { agent } = await loginAs(app);
    expect((await agent.get('/api/v1/users/me/engagement')).body.data).toEqual({ features: {} });
    await agent.patch('/api/v1/users/me/engagement').send({ features: { news: { score: 5, updatedAt: at(1), lastSession: 's-1' } } }).expect(200);
    // An older write (another device) does not overwrite news; a new feature is added.
    const res = await agent
      .patch('/api/v1/users/me/engagement')
      .send({ features: { news: { score: 1, updatedAt: at(10) }, offers: { score: 2, updatedAt: at(2) } } });
    expect(res.status).toBe(200);
    expect(res.body.data.features.news).toMatchObject({ score: 5, lastSession: 's-1' });
    expect(res.body.data.features.offers).toMatchObject({ score: 2 });
    expect((await agent.get('/api/v1/users/me/engagement')).body.data.features).toHaveProperty('offers');
  });

  it('is private to each user and never part of the profile', async () => {
    const a = await loginAs(app);
    const b = await loginAs(app);
    await a.agent.patch('/api/v1/users/me/engagement').send({ features: { news: { score: 9, updatedAt: at(1) } } }).expect(200);
    expect((await b.agent.get('/api/v1/users/me/engagement')).body.data).toEqual({ features: {} });
    const me = await a.agent.get('/api/v1/auth/me');
    expect(JSON.stringify(me.body)).not.toMatch(/featureEngagement|score/);
  });

  it('adds an anonymous record once: the same mergeId is ignored the second time', async () => {
    const { agent } = await loginAs(app);
    const send = (score) =>
      agent.patch('/api/v1/users/me/engagement').send({ mergeId: 'anon-12345678', features: { offers: { score, updatedAt: at(0) } } });
    expect((await send(4)).body.data).toMatchObject({ applied: true, features: { offers: { score: 4 } } });
    const again = await send(8);
    expect(again.body.data).toMatchObject({ applied: false, features: { offers: { score: 4 } } });
  });

  it('rejects bad input and clamps future clocks', async () => {
    const { agent, user } = await loginAs(app);
    const bad = (features, extra = {}) => agent.patch('/api/v1/users/me/engagement').send({ features, ...extra });
    expect((await bad({ 'news-feed': { score: 1, updatedAt: at(0) } })).status).toBe(400);
    expect((await bad({ news: { score: -1, updatedAt: at(0) } })).status).toBe(400);
    expect((await bad({ news: { score: 1, updatedAt: 'yesterday' } })).status).toBe(400);
    expect((await bad({ news: { score: 1, updatedAt: at(0), text: 'x' } })).status).toBe(400);
    const many = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`f${i}`, { score: 1, updatedAt: at(0) }]));
    expect((await bad(many)).status).toBe(400);
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await bad({ news: { score: 1, updatedAt: future } }).expect(200);
    const saved = await User.findById(user._id).select('+featureEngagement').lean();
    expect(new Date(saved.featureEngagement.features.news.updatedAt).getTime()).toBeLessThan(Date.now() + 6 * 60_000);
  });
});
