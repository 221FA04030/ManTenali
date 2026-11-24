import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs } from '../../tests/factories.js';
import { Category } from './categories.model.js';
import { seedCategories, seedCategoryTree, assertActiveCategory, assertCategoryPair } from './categories.service.js';
import { CATEGORY_SEED, BUSINESS_CATEGORY_TREE } from '../../scripts/seedData/categories.js';

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

  it('seedCategories (event/news) is idempotent and keeps admin edits', async () => {
    const first = await seedCategories(CATEGORY_SEED);
    expect(first.created).toBe(CATEGORY_SEED.length);
    await Category.updateOne({ type: 'event', slug: 'sports' }, { 'name.en': 'Edited by admin' });
    const second = await seedCategories(CATEGORY_SEED);
    expect(second).toEqual({ created: 0, existing: CATEGORY_SEED.length });
    expect((await Category.findOne({ slug: 'sports', type: 'event' }).lean()).name.en).toBe('Edited by admin');
    expect(CATEGORY_SEED.every((c) => c.name.te)).toBe(true);
  });
});

describe('two-level business categories', () => {
  it('seedCategoryTree creates the tree, attaches existing flat categories, and is idempotent', async () => {
    // A category from the original flat seed, edited by an admin.
    await make({ slug: 'restaurants', name: { en: 'Restaurants (edited)' } });
    const first = await seedCategoryTree(BUSINESS_CATEGORY_TREE);
    const subCount = BUSINESS_CATEGORY_TREE.reduce((n, m) => n + m.children.length, 0);
    expect(first).toEqual({ createdMain: BUSINESS_CATEGORY_TREE.length, createdSub: subCount - 1, attached: 1 });

    const food = await Category.findOne({ type: 'business', slug: 'food-dining' }).lean();
    const restaurants = await Category.findOne({ type: 'business', slug: 'restaurants' }).lean();
    expect(String(restaurants.parentId)).toBe(String(food._id));
    expect(restaurants.name.en).toBe('Restaurants (edited)'); // admin edit kept
    expect(await Category.countDocuments({ type: 'business', slug: 'restaurants' })).toBe(1); // no duplicate

    const again = await seedCategoryTree(BUSINESS_CATEGORY_TREE);
    expect(again).toEqual({ createdMain: 0, createdSub: 0, attached: 0 });
    for (const main of ['health-medical', 'education', 'hotels-stay', 'events-entertainment']) {
      expect(await Category.exists({ type: 'business', slug: main, parentId: null })).toBeTruthy();
    }
    expect(BUSINESS_CATEGORY_TREE.every((m) => m.name.te && m.children.every((c) => c.name.te))).toBe(true);
  });

  it('admin creates subcategories only under a main business category', async () => {
    const { agent } = await loginAs(app, 'admin');
    const main = (await agent.post('/api/v1/categories').send({ name: { en: 'Pets' }, type: 'business' })).body.data;
    const sub = await agent.post('/api/v1/categories').send({ name: { en: 'Pet Shops' }, type: 'business', parentId: main.id });
    expect(sub.status).toBe(201);
    expect(sub.body.data.parentId).toBe(main.id);
    // no third level
    const third = await agent.post('/api/v1/categories').send({ name: { en: 'Fish' }, type: 'business', parentId: sub.body.data.id });
    expect(third.status).toBe(400);
    // events/news stay flat
    const evt = await agent.post('/api/v1/categories').send({ name: { en: 'Kids' }, type: 'event', parentId: main.id });
    expect(evt.status).toBe(400);
    // parent can't be changed later
    const move = await agent.patch(`/api/v1/categories/${sub.body.data.id}`).send({ parentId: main.id });
    expect(move.status).toBe(400);
  });

  it('hides subcategories of a deactivated main category from the public list', async () => {
    const main = await make({ slug: 'main', parentId: null, isActive: false });
    await make({ slug: 'child', parentId: main._id });
    const res = await request(app).get('/api/v1/categories').query({ type: 'business' });
    expect(res.body.data.map((c) => c.slug)).not.toContain('child');
  });

  it('assertCategoryPair requires an active main category and a subcategory of it', async () => {
    const food = await make({ slug: 'food' });
    const shop = await make({ slug: 'shop' });
    const tiffin = await make({ slug: 'tiffin', parentId: food._id });
    const inactiveSub = await make({ slug: 'old-sub', parentId: food._id, isActive: false });
    await expect(assertCategoryPair(food._id, tiffin._id)).resolves.toMatchObject({ subcategory: { slug: 'tiffin' } });
    await expect(assertCategoryPair(shop._id, tiffin._id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(assertCategoryPair(tiffin._id, tiffin._id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(assertCategoryPair(food._id, inactiveSub._id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(assertCategoryPair(food._id, food._id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
