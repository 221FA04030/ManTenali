import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs, createUser, createCategory, createBusiness } from '../../tests/factories.js';
import { Business } from './businesses.model.js';
import { User } from '../users/users.model.js';
import { assertCanManage, seedBusinesses } from './businesses.service.js';
import { BUSINESS_SEED } from '../../scripts/seedData/businesses.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const CENTER = { lat: 16.2379, lng: 80.6444 };
const at = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });
const photo = (id = 'p1') => ({
  url: `https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/businesses/${id}.jpg`,
  publicId: `mana-tenali/businesses/${id}`,
});

async function validBody(overrides = {}) {
  const cat = await createCategory({ slug: `cat-${Date.now()}` });
  return {
    name: 'Sri Krishna Sweets',
    categoryId: String(cat._id),
    kind: 'food',
    description: 'Fresh sweets daily',
    tags: ['sweets', 'sweets', 'bakery'],
    address: { line: 'Bose Road', area: 'Bose Road', pincode: '522201' },
    location: { lat: 16.24, lng: 80.645 },
    contact: { phone: '+91 98480 12345', whatsapp: '', website: 'https://example.com' },
    openingHours: [{ day: 1, open: '09:00', close: '21:00' }, { day: 0, closed: true }],
    photos: [photo()],
    ...overrides,
  };
}

describe('GET /businesses (public list)', () => {
  it('returns only published businesses with pagination meta', async () => {
    await createBusiness({ name: 'Published A' });
    await createBusiness({ name: 'Draft', status: 'draft' });
    await createBusiness({ name: 'Hidden', status: 'hidden' });
    await createBusiness({ name: 'Archived', status: 'archived' });
    const res = await request(app).get('/api/v1/businesses');
    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.name)).toEqual(['Published A']);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(res.body.data[0]).toMatchObject({ isVerified: false, isSeed: false, contact: { phone: null, whatsapp: null } });
  });

  it('filters by category, kind, area and verified', async () => {
    const cat = await createCategory();
    await createBusiness({ name: 'Match', categoryId: cat._id, kind: 'food', address: { line: 'x', area: 'Kothapeta' }, isVerified: true });
    await createBusiness({ name: 'Wrong kind', categoryId: cat._id, kind: 'shop', address: { line: 'x', area: 'Kothapeta' }, isVerified: true });
    await createBusiness({ name: 'Wrong area', categoryId: cat._id, kind: 'food', address: { line: 'x', area: 'Bose Road' }, isVerified: true });
    await createBusiness({ name: 'Unverified', categoryId: cat._id, kind: 'food', address: { line: 'x', area: 'Kothapeta' } });
    const res = await request(app)
      .get('/api/v1/businesses')
      .query({ categoryId: String(cat._id), kind: 'food', area: 'Kothapeta', isVerified: 'true' });
    expect(res.body.data.map((b) => b.name)).toEqual(['Match']);
  });

  it('sorts by distance within the radius when location is given', async () => {
    await createBusiness({ name: 'Far (8km)', location: at(16.31, 80.6444) });
    await createBusiness({ name: 'Near (1km)', location: at(16.2469, 80.6444) });
    await createBusiness({ name: 'Nearest', location: at(16.2381, 80.6444) });
    const res = await request(app).get('/api/v1/businesses').query({ ...CENTER, radiusKm: 5 });
    expect(res.body.data.map((b) => b.name)).toEqual(['Nearest', 'Near (1km)']);
    expect(res.body.data[0].distanceM).toBeLessThan(50);
    expect(res.body.data[1].distanceM).toBeGreaterThan(900);
    expect(res.body.meta.total).toBe(2);
  });

  it('filters businesses open now (IST)', async () => {
    const allDay = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '00:00', close: '23:59' }));
    const never = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, closed: true }));
    await createBusiness({ name: 'Open', openingHours: allDay });
    await createBusiness({ name: 'Closed', openingHours: never });
    const res = await request(app).get('/api/v1/businesses').query({ openNow: 'true' });
    expect(res.body.data.map((b) => b.name)).toEqual(['Open']);
    expect(res.body.data[0].isOpenNow).toBe(true);
  });

  it('validates query parameters', async () => {
    expect((await request(app).get('/api/v1/businesses').query({ kind: 'bank' })).status).toBe(400);
    expect((await request(app).get('/api/v1/businesses').query({ lat: 16.2 })).status).toBe(400);
    expect((await request(app).get('/api/v1/businesses').query({ sort: 'distance' })).status).toBe(400);
    expect((await request(app).get('/api/v1/businesses').query({ limit: 500 })).status).toBe(400);
    expect((await request(app).get('/api/v1/businesses').query({ radiusKm: 100, ...CENTER })).status).toBe(400);
  });
});

describe('GET /businesses/:slug', () => {
  it('returns published detail without management fields for the public', async () => {
    await createBusiness({ name: 'Detail', slug: 'detail', openingHours: [{ day: 1, open: '09:00', close: '18:00' }] });
    const res = await request(app).get('/api/v1/businesses/detail');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ slug: 'detail', canManage: false, address: { area: 'Main Road' } });
    expect(res.body.data.status).toBeUndefined();
    expect(res.body.data.ownerId).toBeUndefined();
  });

  it('hides draft/hidden businesses from the public but shows them to their owner and admins', async () => {
    const owner = await loginAs(app, 'owner');
    await createBusiness({ slug: 'secret', status: 'hidden', ownerId: owner.user._id });
    expect((await request(app).get('/api/v1/businesses/secret')).status).toBe(404);
    const other = await loginAs(app, 'owner');
    expect((await other.agent.get('/api/v1/businesses/secret')).status).toBe(404);
    const mine = await owner.agent.get('/api/v1/businesses/secret');
    expect(mine.status).toBe(200);
    expect(mine.body.data).toMatchObject({ status: 'hidden', canManage: true });
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.get('/api/v1/businesses/secret')).body.data.ownerId).toBe(String(owner.user._id));
  });

  it('returns 404 for unknown and 400 for malformed slugs', async () => {
    expect((await request(app).get('/api/v1/businesses/nope')).status).toBe(404);
    expect((await request(app).get('/api/v1/businesses/BAD_SLUG!')).status).toBe(400);
  });
});

describe('admin create, edit, archive, verify', () => {
  it('admin creates a draft business with a unique slug, assigning and promoting the owner', async () => {
    const { agent } = await loginAs(app, 'admin');
    const futureOwner = await createUser();
    const res = await agent.post('/api/v1/businesses').send(await validBody({ ownerId: String(futureOwner._id) }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      slug: 'sri-krishna-sweets',
      status: 'draft',
      isVerified: false,
      tags: ['sweets', 'bakery'],
      location: { lat: 16.24, lng: 80.645 },
      contact: { phone: '+91 98480 12345', whatsapp: null },
      ownerId: String(futureOwner._id),
    });
    expect((await User.findById(futureOwner._id).lean()).role).toBe('owner');

    const second = await agent.post('/api/v1/businesses').send(await validBody());
    expect(second.body.data.slug).toMatch(/^sri-krishna-sweets-[a-z0-9]{5}$/);
  });

  it('rejects invalid input, foreign images, unknown categories and blocked owners', async () => {
    const { agent } = await loginAs(app, 'admin');
    const bad = await agent.post('/api/v1/businesses').send({ name: 'X', kind: 'bank' });
    expect(bad.status).toBe(400);
    const foreign = await agent
      .post('/api/v1/businesses')
      .send(await validBody({ photos: [{ url: 'https://evil.example/a.jpg', publicId: 'mana-tenali/businesses/a' }] }));
    expect(foreign.status).toBe(400);
    const eventCat = await createCategory({ type: 'event', slug: 'evt' });
    const wrongType = await agent.post('/api/v1/businesses').send(await validBody({ categoryId: String(eventCat._id) }));
    expect(wrongType.status).toBe(400);
    const blocked = await createUser({ status: 'blocked' });
    const blockedOwner = await agent.post('/api/v1/businesses').send(await validBody({ ownerId: String(blocked._id) }));
    expect(blockedOwner.status).toBe(400);
    const badHours = await agent
      .post('/api/v1/businesses')
      .send(await validBody({ openingHours: [{ day: 1, open: '9am', close: '21:00' }] }));
    expect(badHours.status).toBe(400);
  });

  it('only admins can create, archive and verify', async () => {
    for (const role of ['user', 'owner']) {
      const { agent } = await loginAs(app, role);
      expect((await agent.post('/api/v1/businesses').send(await validBody())).status).toBe(403);
      const b = await createBusiness();
      expect((await agent.delete(`/api/v1/businesses/${b._id}`)).status).toBe(403);
      expect((await agent.patch(`/api/v1/admin/businesses/${b._id}/verify`).send({ isVerified: true })).status).toBe(403);
    }
    const anon = await request(app).post('/api/v1/businesses').set('Origin', TEST_ORIGIN).send({});
    expect(anon.status).toBe(401);
  });

  it('admin publishes, hides, archives (soft delete) and verifies', async () => {
    const { agent } = await loginAs(app, 'admin');
    const b = await createBusiness({ status: 'draft', slug: 'flow' });
    expect((await agent.patch(`/api/v1/businesses/${b._id}`).send({ status: 'published' })).body.data.status).toBe('published');
    expect((await request(app).get('/api/v1/businesses/flow')).status).toBe(200);

    const v = await agent.patch(`/api/v1/admin/businesses/${b._id}/verify`).send({ isVerified: true });
    expect(v.body.data.isVerified).toBe(true);
    expect(v.body.data.verifiedAt).toBeTruthy();

    expect((await agent.patch(`/api/v1/businesses/${b._id}`).send({ status: 'hidden' })).status).toBe(200);
    expect((await request(app).get('/api/v1/businesses/flow')).status).toBe(404);

    const del = await agent.delete(`/api/v1/businesses/${b._id}`);
    expect(del.body.data.status).toBe('archived');
    expect(await Business.countDocuments({ _id: b._id })).toBe(1); // soft delete
  });

  it('keeps the slug when the name changes and refuses to verify sample data', async () => {
    const { agent } = await loginAs(app, 'admin');
    const b = await createBusiness({ slug: 'stable-slug' });
    const res = await agent.patch(`/api/v1/businesses/${b._id}`).send({ name: 'Renamed Shop' });
    expect(res.body.data).toMatchObject({ name: 'Renamed Shop', slug: 'stable-slug' });
    const seed = await createBusiness({ isSeed: true });
    const v = await agent.patch(`/api/v1/admin/businesses/${seed._id}/verify`).send({ isVerified: true });
    expect(v.status).toBe(400);
  });

  it('admin lists all businesses with search and status filter', async () => {
    const { agent } = await loginAs(app, 'admin');
    await createBusiness({ name: 'Ganesh Stores', status: 'draft' });
    await createBusiness({ name: 'Other' });
    const res = await agent.get('/api/v1/admin/businesses').query({ q: 'ganesh', status: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.name)).toEqual(['Ganesh Stores']);
    expect(res.body.meta.total).toBe(1);
  });
});

describe('owner edits (FR-BUS-5)', () => {
  it('owner edits description, hours, contact and photos of their own business', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await createBusiness({ ownerId: owner.user._id, status: 'draft' });
    const res = await owner.agent.patch(`/api/v1/businesses/${b._id}`).send({
      description: 'Now open on Sundays',
      openingHours: [{ day: 0, open: '18:00', close: '01:00' }],
      contact: { phone: '+91 90000 11111' },
      photos: [photo('a'), photo('b')],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ description: 'Now open on Sundays', contact: { phone: '+91 90000 11111' } });
    expect(res.body.data.photos).toHaveLength(2);
    const stored = await Business.findById(b._id).lean();
    expect(stored.openingHours[0].overnight).toBe(true);
  });

  it('owner cannot change admin-only fields or edit other businesses', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await createBusiness({ ownerId: owner.user._id });
    const statusChange = await owner.agent.patch(`/api/v1/businesses/${b._id}`).send({ status: 'published' });
    expect(statusChange.status).toBe(400); // unknown field for owners (strict schema)
    const rename = await owner.agent.patch(`/api/v1/businesses/${b._id}`).send({ name: 'New name' });
    expect(rename.status).toBe(400);
    const other = await createBusiness();
    const foreign = await owner.agent.patch(`/api/v1/businesses/${other._id}`).send({ description: 'hack' });
    expect(foreign.status).toBe(403);
    const user = await loginAs(app, 'user');
    expect((await user.agent.patch(`/api/v1/businesses/${b._id}`).send({ description: 'x' })).status).toBe(403);
  });

  it('GET /businesses/mine lists only the owner’s non-archived businesses', async () => {
    const owner = await loginAs(app, 'owner');
    await createBusiness({ name: 'Mine', ownerId: owner.user._id, status: 'draft' });
    await createBusiness({ name: 'Old', ownerId: owner.user._id, status: 'archived' });
    await createBusiness({ name: 'Not mine' });
    const res = await owner.agent.get('/api/v1/businesses/mine');
    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.name)).toEqual(['Mine']);
    const user = await loginAs(app, 'user');
    expect((await user.agent.get('/api/v1/businesses/mine')).status).toBe(403);
  });
});

describe('service rules', () => {
  it('assertCanManage allows owner and admin only', async () => {
    const owner = await createUser({ role: 'owner' });
    const b = await createBusiness({ ownerId: owner._id });
    await expect(assertCanManage({ id: String(owner._id), role: 'owner' }, b._id)).resolves.toBeTruthy();
    await expect(assertCanManage({ id: 'x', role: 'admin' }, b._id)).resolves.toBeTruthy();
    await expect(assertCanManage({ id: '64b000000000000000000000', role: 'owner' }, b._id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('seedBusinesses creates sample, unverified, published listings idempotently', async () => {
    const slugs = [...new Set(BUSINESS_SEED.map((b) => b.categorySlug))];
    const ids = new Map();
    for (const slug of slugs) ids.set(slug, (await createCategory({ slug }))._id);
    const first = await seedBusinesses(BUSINESS_SEED, ids);
    expect(first.created).toBe(BUSINESS_SEED.length);
    const again = await seedBusinesses(BUSINESS_SEED, ids);
    expect(again.created).toBe(0);
    const all = await Business.find().lean();
    expect(all.every((b) => b.isSeed && !b.isVerified && b.status === 'published')).toBe(true);
  });

  it('uses the spec indexes for list queries', async () => {
    await Business.init();
    const names = (await Business.collection.indexes()).map((i) => Object.keys(i.key).join(','));
    expect(names).toEqual(
      expect.arrayContaining(['slug', 'location', '_fts,_ftsx', 'status,categoryId,address.area', 'ownerId', 'status,kind']),
    );
    await createBusiness();
    const plan = await Business.find({ status: 'published', kind: 'shop' }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
  });
});
