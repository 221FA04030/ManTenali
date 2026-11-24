import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs } from '../../tests/factories.js';
import { Category } from './categories.model.js';
import { seedCategories, assertActiveCategory } from './categories.service.js';
import { CATEGORY_SEED } from '../../scripts/seedData/categories.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const make = (overrides) =>
  Category.create({ name: { en: 'Restaurants', te: 'రెస్టారెంట్లు' }, slug: 'restaurants', type: 'business', sortOrder: 10, ...overrides });

describe('GET /categories', () => {
  it('lists active categories of a type, sorted by sortOrder', async () => {
    await make({ slug: 'b', name: { en: 'B' }, sortOrder: 20 });
    await make({ slug: 'a', name: { en: 'A' }, sortOrder: 10 });
    await make({ slug: 'hidden', name: { en: 'Hidden' }, isActive: false });
    await make({ slug: 'fest', name: { en: 'Festivals' }, type: 'event' });

    const res = await request(app).get('/api/v1/categories').query({ type: 'business' });
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.slug)).toEqual(['a', 'b']);
    expect(res.body.data[0]).toMatchObject({ type: 'business', isActive: true, name: { en: 'A', te: null } });
  });

  it('includes inactive categories only for admins who ask', async () => {
    await make({ slug: 'hidden', isActive: false });
    const anon = await request(app).get('/api/v1/categories').query({ type: 'business', includeInactive: 'true' });
    expect(anon.body.data).toHaveLength(0);
    const { agent } = await loginAs(app, 'admin');
    const admin = await agent.get('/api/v1/categories').query({ type: 'business', includeInactive: 'true' });
    expect(admin.body.data).toHaveLength(1);
  });

  it('rejects an unknown type', async () => {
    const res = await request(app).get('/api/v1/categories').query({ type: 'jobs' });
    expect(res.status).toBe(400);
  });
});

describe('POST /categories and PATCH /categories/:id', () => {
  it('admin creates a category with a generated slug', async () => {
    const { agent } = await loginAs(app, 'admin');
    const res = await agent
      .post('/api/v1/categories')
      .send({ name: { en: 'Sweets & Bakery', te: 'స్వీట్స్' }, type: 'business', icon: 'cake', sortOrder: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ slug: 'sweets-and-bakery', type: 'business', icon: 'cake', isActive: true });
  });

  it('rejects duplicate slugs within a type but allows them across types', async () => {
    const { agent } = await loginAs(app, 'admin');
    await agent.post('/api/v1/categories').send({ name: { en: 'Sports' }, type: 'event' });
    const dup = await agent.post('/api/v1/categories').send({ name: { en: 'Sports' }, type: 'event' });
    expect(dup.status).toBe(409);
    const otherType = await agent.post('/api/v1/categories').send({ name: { en: 'Sports' }, type: 'news' });
    expect(otherType.status).toBe(201);
  });

  it('only admins can create or update', async () => {
    const cat = await make();
    for (const role of ['user', 'owner']) {
      const { agent } = await loginAs(app, role);
      expect((await agent.post('/api/v1/categories').send({ name: { en: 'X' }, type: 'event' })).status).toBe(403);
      expect((await agent.patch(`/api/v1/categories/${cat._id}`).send({ isActive: false })).status).toBe(403);
    }
    const anon = await request(app).post('/api/v1/categories').set('Origin', TEST_ORIGIN).send({ name: { en: 'X' }, type: 'event' });
    expect(anon.status).toBe(401);
  });

  it('updates names, order and deactivates; slug and type cannot change', async () => {
    const cat = await make();
    const { agent } = await loginAs(app, 'admin');
    const res = await agent
      .patch(`/api/v1/categories/${cat._id}`)
      .send({ name: { en: 'Restaurants & Hotels' }, sortOrder: 1, isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: { en: 'Restaurants & Hotels', te: null }, sortOrder: 1, isActive: false, slug: 'restaurants' });
    const bad = await agent.patch(`/api/v1/categories/${cat._id}`).send({ slug: 'new-slug', type: 'event' });
    expect(bad.status).toBe(400);
  });

  it('validates input and returns 404 for unknown ids', async () => {
    const { agent } = await loginAs(app, 'admin');
    const bad = await agent.post('/api/v1/categories').send({ name: { en: '' }, type: 'business', icon: 'Bad Icon!' });
    expect(bad.status).toBe(400);
    const missing = await agent.patch('/api/v1/categories/64b000000000000000000000').send({ isActive: false });
    expect(missing.status).toBe(404);
  });
});

describe('category service rules', () => {
  it('assertActiveCategory checks existence, type and active flag', async () => {
    const cat = await make();
    const inactive = await make({ slug: 'old', isActive: false });
    await expect(assertActiveCategory(cat._id, 'business')).resolves.toMatchObject({ slug: 'restaurants' });
    await expect(assertActiveCategory(cat._id, 'event')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(assertActiveCategory(inactive._id, 'business')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('seedCategories is idempotent and keeps admin edits', async () => {
    const first = await seedCategories(CATEGORY_SEED);
    expect(first.created).toBe(CATEGORY_SEED.length);
    await Category.updateOne({ type: 'business', slug: 'restaurants' }, { 'name.en': 'Edited by admin' });
    const second = await seedCategories(CATEGORY_SEED);
    expect(second).toEqual({ created: 0, existing: CATEGORY_SEED.length });
    expect((await Category.findOne({ slug: 'restaurants', type: 'business' }).lean()).name.en).toBe('Edited by admin');
    expect(CATEGORY_SEED.every((c) => c.name.te)).toBe(true);
  });
});
