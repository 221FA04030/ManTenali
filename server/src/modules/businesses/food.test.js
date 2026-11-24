import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb } from '../../tests/helpers.js';
import { loginAs, createCategory, createBusiness } from '../../tests/factories.js';
import { Business, MENU_LIMITS } from './businesses.model.js';

let app;
let food;
let tiffin;
let shopping;
let footwear;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  food = await createCategory({ slug: 'food-dining' });
  tiffin = await createCategory({ slug: 'tiffin-centres', parentId: food._id });
  shopping = await createCategory({ slug: 'shopping' });
  footwear = await createCategory({ slug: 'footwear', parentId: shopping._id });
});

const menu = [
  { section: 'Tiffins', items: [{ name: 'Idli (2)', price: 30, isVeg: true }, { name: 'Egg Dosa', price: 60 }] },
  { section: 'Beverages', items: [{ name: 'Filter Coffee', price: 20, isVeg: true }] },
];

const foodPlace = (overrides = {}) =>
  createBusiness({
    kind: 'food',
    categoryId: food._id,
    subcategoryId: tiffin._id,
    priceRange: 1,
    food: { cuisines: ['south-indian'], isVegFriendly: true, menu },
    ...overrides,
  });

describe('food details on public endpoints (FR-FOOD-1)', () => {
  it('detail shows cuisines, price range and the full menu with veg flags', async () => {
    await foodPlace({ slug: 'annapurna' });
    const res = await request(app).get('/api/v1/businesses/annapurna');
    expect(res.status).toBe(200);
    expect(res.body.data.priceRange).toBe(1);
    expect(res.body.data.food).toEqual({
      cuisines: ['south-indian'],
      isVegFriendly: true,
      menu: [
        { section: 'Tiffins', items: [{ name: 'Idli (2)', price: 30, isVeg: true }, { name: 'Egg Dosa', price: 60, isVeg: false }] },
        { section: 'Beverages', items: [{ name: 'Filter Coffee', price: 20, isVeg: true }] },
      ],
    });
  });

  it('list cards carry a small food summary without the menu', async () => {
    await foodPlace();
    await createBusiness({ name: 'Shoe Shop', kind: 'shop' });
    const res = await request(app).get('/api/v1/businesses');
    const card = res.body.data.find((b) => b.kind === 'food');
    expect(card.food).toEqual({ cuisines: ['south-indian'], isVegFriendly: true });
    expect(card.priceRange).toBe(1);
    expect(JSON.stringify(card)).not.toContain('Idli');
    expect(res.body.data.find((b) => b.kind === 'shop').food).toBeNull();
  });
});

describe('food filters (FR-FOOD-2)', () => {
  beforeEach(async () => {
    await foodPlace({ name: 'Tiffins', priceRange: 1, food: { cuisines: ['south-indian'], isVegFriendly: true, menu: [] } });
    await foodPlace({ name: 'Biryani House', priceRange: 2, food: { cuisines: ['biryani', 'andhra'], isVegFriendly: false, menu: [] } });
    await foodPlace({ name: 'Fine Dine', priceRange: 3, food: { cuisines: ['north-indian', 'chinese'], isVegFriendly: true, menu: [] } });
    await foodPlace({ name: 'Hidden Biryani', status: 'pending', food: { cuisines: ['biryani'], isVegFriendly: false, menu: [] } });
    await createBusiness({ name: 'Veg Shop', kind: 'shop' });
  });
  const names = async (query) => (await request(app).get('/api/v1/businesses').query(query)).body.data.map((b) => b.name).sort();

  it('filters by cuisine, price range and veg-friendly (published food businesses only)', async () => {
    expect(await names({ cuisine: 'biryani' })).toEqual(['Biryani House']);
    expect(await names({ kind: 'food', priceRange: 3 })).toEqual(['Fine Dine']);
    expect(await names({ isVegFriendly: 'true' })).toEqual(['Fine Dine', 'Tiffins']);
    expect(await names({ cuisine: 'north-indian', isVegFriendly: 'true', priceRange: 3 })).toEqual(['Fine Dine']);
    expect(await names({ kind: 'food' })).toEqual(['Biryani House', 'Fine Dine', 'Tiffins']);
  });

  it('rejects unknown cuisines and price ranges', async () => {
    expect((await request(app).get('/api/v1/businesses').query({ cuisine: 'pizza' })).status).toBe(400);
    expect((await request(app).get('/api/v1/businesses').query({ priceRange: 4 })).status).toBe(400);
  });
});

describe('editing food details and menus', () => {
  it('owners update the menu and food details of an approved listing directly', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await foodPlace({ ownerId: owner.user._id });
    const res = await owner.agent.patch(`/api/v1/businesses/${b._id}`).send({
      priceRange: 2,
      food: { menu: [{ section: 'Meals', items: [{ name: 'Andhra Meals', price: 120, isVeg: true }] }] },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.priceRange).toBe(2);
    expect(res.body.data.food).toEqual({
      cuisines: ['south-indian'], // untouched fields are kept
      isVegFriendly: true,
      menu: [{ section: 'Meals', items: [{ name: 'Andhra Meals', price: 120, isVeg: true }] }],
    });
    const cleared = await owner.agent.patch(`/api/v1/businesses/${b._id}`).send({ priceRange: null });
    expect(cleared.body.data.priceRange).toBeNull();
  });

  it('food details are rejected for non-food businesses', async () => {
    const owner = await loginAs(app, 'owner');
    const shop = await createBusiness({ kind: 'shop', ownerId: owner.user._id });
    const res = await owner.agent.patch(`/api/v1/businesses/${shop._id}`).send({ food: { cuisines: ['biryani'] } });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('body.food');
  });

  it('validates menus: names, prices, sizes and cuisines', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await foodPlace({ ownerId: owner.user._id });
    const patch = (body) => owner.agent.patch(`/api/v1/businesses/${b._id}`).send(body);
    expect((await patch({ food: { menu: [{ section: 'X', items: [{ name: '', price: 10 }] }] } })).status).toBe(400);
    expect((await patch({ food: { menu: [{ section: 'X', items: [{ name: 'Tea', price: -5 }] }] } })).status).toBe(400);
    expect((await patch({ food: { menu: [{ section: 'X', items: [{ name: 'Tea', price: '10' }] }] } })).status).toBe(400);
    expect((await patch({ food: { menu: [{ section: 'Empty', items: [] }] } })).status).toBe(400);
    expect((await patch({ food: { cuisines: ['pizza'] } })).status).toBe(400);
    expect((await patch({ food: { cuisines: ['andhra', 'andhra'] } })).status).toBe(400);
    expect((await patch({ priceRange: 5 })).status).toBe(400);
    const tooMany = Array.from({ length: 5 }, (_, i) => ({
      section: `S${i}`,
      items: Array.from({ length: MENU_LIMITS.itemsPerSection }, (_, j) => ({ name: `Item ${j}`, price: 10 })),
    }));
    expect((await patch({ food: { menu: tooMany } })).status).toBe(400);
    expect((await Business.findById(b._id).lean()).food.menu).toHaveLength(2); // unchanged
  });

  it('submissions in a food category get kind food and may include the menu', async () => {
    const { agent } = await loginAs(app, 'user');
    const res = await agent.post('/api/v1/businesses/submissions').send({
      name: 'Lakshmi Tiffins',
      categoryId: String(food._id),
      subcategoryId: String(tiffin._id),
      address: { line: 'Near Clock Tower', area: 'Bose Road' },
      location: { lat: 16.24, lng: 80.645 },
      contact: { phone: '+91 98765 43210' },
      priceRange: 1,
      food: { cuisines: ['south-indian'], isVegFriendly: true, menu },
      submit: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ kind: 'food', priceRange: 1, food: { cuisines: ['south-indian'], isVegFriendly: true } });
    expect(res.body.data.food.menu).toHaveLength(2);

    const shop = await agent.post('/api/v1/businesses/submissions').send({
      name: 'Ravi Footwear',
      categoryId: String(shopping._id),
      subcategoryId: String(footwear._id),
      address: { line: 'Main Road', area: 'Main Road' },
      location: { lat: 16.24, lng: 80.645 },
      contact: { phone: '+91 98765 43210' },
      food: { cuisines: ['biryani'] },
    });
    expect(shop.status).toBe(400);
  });

  it('admin changing a business away from food removes its food details', async () => {
    const { agent } = await loginAs(app, 'admin');
    const b = await foodPlace();
    const res = await agent
      .patch(`/api/v1/businesses/${b._id}`)
      .send({ kind: 'shop', categoryId: String(shopping._id), subcategoryId: String(footwear._id) });
    expect(res.status).toBe(200);
    expect(res.body.data.food).toBeNull();
    expect((await Business.findById(b._id).lean()).food).toBeUndefined();
  });

  it('food filter queries use an index', async () => {
    await foodPlace();
    await Business.init();
    const plan = await Business.find({ status: 'published', kind: 'food', 'food.cuisines': 'south-indian' }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
  });
});
