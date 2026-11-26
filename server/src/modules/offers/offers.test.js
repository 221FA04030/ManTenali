import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN, enterProductionEnv } from '../../tests/helpers.js';
import { loginAs, createCategory, createBusiness } from '../../tests/factories.js';
import { Offer, OFFER_LIMIT_PER_BUSINESS } from './offers.model.js';
import { listPublic, getOffer, seedOffers } from './offers.service.js';
import { Business } from '../businesses/businesses.model.js';
import { istEndOfDay, istStartOfDay, toIstDate, addOneYear } from '../../common/utils/dates.js';
import { resetEnvCache } from '../../config/env.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const DAY = 86_400_000;
/** IST date n days from now, "YYYY-MM-DD". */
const day = (n) => toIstDate(new Date(Date.now() + n * DAY));

/** Insert an offer directly (published and valid today by default). */
function makeOffer(businessId, overrides = {}) {
  return Offer.create({
    businessId,
    title: 'Free coffee with dosa',
    discountLabel: 'Free coffee',
    terms: 'One per bill, dine-in only.',
    validFrom: istStartOfDay(day(-1)),
    validTo: istEndOfDay(day(5)),
    status: 'published',
    ...overrides,
  });
}

const body = (businessId, overrides = {}) => ({
  businessId: String(businessId),
  title: '20% off on all sweets',
  discountLabel: '20% off',
  terms: 'Valid on purchases above Rs 200.',
  redemptionInstructions: 'Show this offer at the counter.',
  validFrom: day(0),
  validTo: day(10),
  status: 'published',
  ...overrides,
});

const offerImage = (id = 'o1') => ({
  url: `https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/offers/${id}.jpg`,
  publicId: `mana-tenali/offers/${id}`,
});

describe('public visibility (FR-OFF-1)', () => {
  it('the feed lists only published, currently valid offers of published businesses', async () => {
    const b = await createBusiness({ name: 'Sweets' });
    await makeOffer(b._id, { title: 'Live' });
    await makeOffer(b._id, { title: 'Draft', status: 'draft' });
    await makeOffer(b._id, { title: 'Hidden', status: 'hidden' });
    await makeOffer(b._id, { title: 'Scheduled', validFrom: istStartOfDay(day(2)), validTo: istEndOfDay(day(9)) });
    await makeOffer(b._id, { title: 'Expired', validFrom: istStartOfDay(day(-10)), validTo: istEndOfDay(day(-1)) });

    const res = await request(app).get('/api/v1/offers');
    expect(res.status).toBe(200);
    expect(res.body.data.map((o) => o.title)).toEqual(['Live']);
    expect(res.body.data[0]).toMatchObject({ business: { name: 'Sweets' }, canManage: false });
    expect(res.body.data[0].status).toBeUndefined();
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('offers of draft, pending, rejected, hidden and archived businesses are hidden everywhere', async () => {
    for (const status of ['draft', 'pending', 'rejected', 'hidden', 'archived']) {
      const b = await createBusiness({ status });
      const o = await makeOffer(b._id);
      expect((await request(app).get(`/api/v1/offers/${o._id}`)).status).toBe(404);
      expect((await request(app).get(`/api/v1/businesses/${b._id}/offers`)).status).toBe(404);
    }
    expect((await request(app).get('/api/v1/offers')).body.data).toEqual([]);
  });

  it('hiding a business hides its offers immediately, without touching the offers', async () => {
    const b = await createBusiness();
    const o = await makeOffer(b._id);
    expect((await request(app).get(`/api/v1/offers/${o._id}`)).status).toBe(200);
    await Business.updateOne({ _id: b._id }, { status: 'hidden' });
    expect((await request(app).get(`/api/v1/offers/${o._id}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/offers')).body.data).toEqual([]);
    expect((await Offer.findById(o._id).lean()).status).toBe('published');
  });

  it('detail and business offers apply the same rules (scheduled, expired, draft, hidden -> 404 / not listed)', async () => {
    const b = await createBusiness();
    const live = await makeOffer(b._id, { title: 'Live' });
    const others = [
      await makeOffer(b._id, { status: 'draft' }),
      await makeOffer(b._id, { status: 'hidden' }),
      await makeOffer(b._id, { validFrom: istStartOfDay(day(3)), validTo: istEndOfDay(day(9)) }),
      await makeOffer(b._id, { validFrom: istStartOfDay(day(-9)), validTo: istEndOfDay(day(-2)) }),
    ];
    expect((await request(app).get(`/api/v1/offers/${live._id}`)).status).toBe(200);
    for (const o of others) expect((await request(app).get(`/api/v1/offers/${o._id}`)).status).toBe(404);
    const list = await request(app).get(`/api/v1/businesses/${b._id}/offers`);
    expect(list.body.data.map((o) => o.title)).toEqual(['Live']);
    expect(list.body.meta).toEqual({ total: 1, limit: 5 });
  });

  it('business offers are limited (default 5, max 20) and ending soonest come first', async () => {
    const b = await createBusiness();
    for (let i = 1; i <= 7; i += 1) await makeOffer(b._id, { title: `Offer ${i}`, validTo: istEndOfDay(day(i)) });
    const res = await request(app).get(`/api/v1/businesses/${b._id}/offers`);
    expect(res.body.data.map((o) => o.title)).toEqual(['Offer 1', 'Offer 2', 'Offer 3', 'Offer 4', 'Offer 5']);
    expect(res.body.meta.total).toBe(7);
    expect((await request(app).get(`/api/v1/businesses/${b._id}/offers`).query({ limit: 50 })).status).toBe(400);
  });
});

describe('dates in Tenali time (IST)', () => {
  it('an offer ending on a date stays valid until the end of that day in IST, not midnight UTC', async () => {
    const b = await createBusiness();
    const { agent } = await loginAs(app, 'admin');
    const created = await agent.post('/api/v1/offers').send(body(b._id, { validFrom: day(0), validTo: day(3) }));
    expect(created.body.data).toMatchObject({ validFromDate: day(0), validToDate: day(3) });
    expect(new Date(created.body.data.validTo).toISOString()).toBe(istEndOfDay(day(3)).toISOString());
    const o = await makeOffer(b._id, { validFrom: istStartOfDay('2026-11-01'), validTo: istEndOfDay('2026-11-30') });
    expect(o.validFrom.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(o.validTo.toISOString()).toBe('2026-11-30T18:29:59.999Z');

    const lateEvening = new Date('2026-11-30T23:30:00+05:30'); // 18:00 UTC, after UTC "midnight" logic would cut it
    const after = new Date('2026-12-01T00:00:01+05:30');
    const titles = async (now) => (await listPublic({ page: 1, limit: 20 }, now)).items.map((x) => x.id);
    expect(await titles(lateEvening)).toContain(String(o._id));
    expect(await titles(after)).not.toContain(String(o._id));
    await expect(getOffer(o._id, null, new Date('2026-10-31T23:59:00+05:30'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getOffer(o._id, null, new Date('2026-11-01T00:00:00+05:30'))).resolves.toMatchObject({ validToDate: '2026-11-30' });
  });

  it('validates dates: end on/after start, at most one year, not already over', async () => {
    const b = await createBusiness();
    const { agent } = await loginAs(app, 'admin');
    const post = (o) => agent.post('/api/v1/offers').send(body(b._id, o));
    expect((await post({ validFrom: day(5), validTo: day(4) })).status).toBe(400);
    expect((await post({ validFrom: day(0), validTo: addOneYear(day(0)) })).status).toBe(400);
    expect((await post({ validFrom: day(-10), validTo: day(-1) })).status).toBe(400);
    expect((await post({ validFrom: '2026-02-30', validTo: day(3) })).status).toBe(400);
    const oneDay = await post({ validFrom: day(0), validTo: day(0) });
    expect(oneDay.status).toBe(201);
    const almostYear = await post({ title: 'Long offer', validFrom: day(0), validTo: toIstDate(new Date(istStartOfDay(addOneYear(day(0))).getTime() - DAY + 1000)) });
    expect(almostYear.status).toBe(201);
  });
});

describe('input validation', () => {
  it('requires fields, enforces lengths, coupon format and rejects unknown fields', async () => {
    const b = await createBusiness();
    const { agent } = await loginAs(app, 'admin');
    const post = (o) => agent.post('/api/v1/offers').send(body(b._id, o));
    expect((await post({ title: undefined })).status).toBe(400);
    expect((await post({ terms: 'short' })).status).toBe(400);
    expect((await post({ title: 'x'.repeat(121) })).status).toBe(400);
    expect((await post({ discountLabel: 'x'.repeat(41) })).status).toBe(400);
    expect((await post({ couponCode: 'no spaces!' })).status).toBe(400);
    expect((await post({ status: 'live' })).status).toBe(400);
    expect((await post({ isSeed: true })).status).toBe(400);
    const ok = await post({ couponCode: 'tenali-15' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.couponCode).toBe('TENALI-15');
    const move = await agent.patch(`/api/v1/offers/${ok.body.data.id}`).send({ businessId: String(b._id) });
    expect(move.status).toBe(400);
  });

  it('images must come from the app’s own upload system (offers folder)', async () => {
    const b = await createBusiness();
    const { agent } = await loginAs(app, 'admin');
    const bad = await agent.post('/api/v1/offers').send(body(b._id, { image: { url: 'https://evil.example/x.jpg', publicId: 'mana-tenali/offers/x' } }));
    expect(bad.status).toBe(400);
    const businessPhoto = {
      url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/businesses/o1.jpg',
      publicId: 'mana-tenali/businesses/o1',
    };
    const wrongFolder = await agent.post('/api/v1/offers').send(body(b._id, { image: businessPhoto }));
    expect(wrongFolder.status).toBe(400);
    const good = await agent.post('/api/v1/offers').send(body(b._id, { image: offerImage() }));
    expect(good.status).toBe(201);
    expect(good.body.data.image).toEqual(offerImage());
  });
});

describe('permissions (FR-OFF-3)', () => {
  it('owners create, edit and hide offers of their own business', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await createBusiness({ ownerId: owner.user._id });
    const created = await owner.agent.post('/api/v1/offers').send(body(b._id));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'published', displayStatus: 'live', canManage: true });
    const id = created.body.data.id;
    const edited = await owner.agent.patch(`/api/v1/offers/${id}`).send({ discountLabel: '25% off' });
    expect(edited.body.data.discountLabel).toBe('25% off');
    expect((await owner.agent.delete(`/api/v1/offers/${id}`)).body.data).toEqual({ id, status: 'hidden' });
  });

  it('owners get 404 for another owner’s business and offers', async () => {
    const owner = await loginAs(app, 'owner');
    const other = await createBusiness();
    const o = await makeOffer(other._id);
    expect((await owner.agent.post('/api/v1/offers').send(body(other._id))).status).toBe(404);
    expect((await owner.agent.patch(`/api/v1/offers/${o._id}`).send({ title: 'Hacked offer' })).status).toBe(404);
    expect((await owner.agent.delete(`/api/v1/offers/${o._id}`)).status).toBe(404);
    expect((await owner.agent.get('/api/v1/offers/mine').query({ businessId: String(other._id) })).status).toBe(404);
    expect((await Offer.findById(o._id).lean()).title).toBe('Free coffee with dosa');
  });

  it('regular users and visitors are refused', async () => {
    const b = await createBusiness();
    const o = await makeOffer(b._id);
    const { agent } = await loginAs(app, 'user');
    expect((await agent.post('/api/v1/offers').send(body(b._id))).status).toBe(403);
    expect((await agent.patch(`/api/v1/offers/${o._id}`).send({ title: 'Changed title' })).status).toBe(403);
    expect((await agent.delete(`/api/v1/offers/${o._id}`)).status).toBe(403);
    const anon = (r) => r.set('Origin', TEST_ORIGIN);
    expect((await anon(request(app).post('/api/v1/offers')).send(body(b._id))).status).toBe(401);
    expect((await anon(request(app).delete(`/api/v1/offers/${o._id}`))).status).toBe(401);
  });

  it('admins manage offers of any business and see non-public offers', async () => {
    const b = await createBusiness();
    const draft = await makeOffer(b._id, { status: 'draft' });
    const { agent } = await loginAs(app, 'admin');
    const detail = await agent.get(`/api/v1/offers/${draft._id}`);
    expect(detail.body.data).toMatchObject({ status: 'draft', displayStatus: 'draft', canManage: true });
    expect((await agent.patch(`/api/v1/offers/${draft._id}`).send({ status: 'published' })).body.data.displayStatus).toBe('live');
    expect((await agent.post('/api/v1/offers').send(body(b._id))).status).toBe(201);
  });

  it('only published businesses can receive new offers or publish them', async () => {
    const { agent } = await loginAs(app, 'admin');
    for (const status of ['draft', 'pending', 'rejected', 'hidden']) {
      const b = await createBusiness({ status });
      expect((await agent.post('/api/v1/offers').send(body(b._id))).status).toBe(400);
    }
    const archived = await createBusiness({ status: 'archived' });
    expect((await agent.post('/api/v1/offers').send(body(archived._id))).status).toBe(404);
    const hiddenBiz = await createBusiness({ status: 'hidden' });
    const draftOffer = await makeOffer(hiddenBiz._id, { status: 'draft' });
    expect((await agent.patch(`/api/v1/offers/${draftOffer._id}`).send({ status: 'published' })).status).toBe(400);
    expect((await agent.patch(`/api/v1/offers/${draftOffer._id}`).send({ title: 'Edited while hidden' })).status).toBe(200);
  });
});

describe('filters, sorting and pagination', () => {
  it('filters by category, subcategory, area, near me and business', async () => {
    const food = await createCategory({ slug: 'food' });
    const tiffin = await createCategory({ slug: 'tiffin', parentId: food._id });
    const shop = await createCategory({ slug: 'shop' });
    const a = await createBusiness({ name: 'Tiffins', categoryId: food._id, subcategoryId: tiffin._id, address: { line: 'x', area: 'Bose Road' } });
    const c = await createBusiness({
      name: 'Far Shop',
      categoryId: shop._id,
      address: { line: 'x', area: 'Kothapeta' },
      location: { type: 'Point', coordinates: [80.6444, 16.35] },
    });
    await makeOffer(a._id, { title: 'Tiffin offer' });
    await makeOffer(c._id, { title: 'Shop offer' });
    const titles = async (q) => (await request(app).get('/api/v1/offers').query(q)).body.data.map((o) => o.title).sort();
    expect(await titles({ categoryId: String(food._id) })).toEqual(['Tiffin offer']);
    expect(await titles({ subcategoryId: String(tiffin._id) })).toEqual(['Tiffin offer']);
    expect(await titles({ area: 'Kothapeta' })).toEqual(['Shop offer']);
    expect(await titles({ lat: 16.2379, lng: 80.6444, radiusKm: 5 })).toEqual(['Tiffin offer']);
    expect(await titles({ businessId: String(c._id) })).toEqual(['Shop offer']);
    expect(await titles({})).toEqual(['Shop offer', 'Tiffin offer']);
    expect((await request(app).get('/api/v1/offers').query({ lat: 16.2 })).status).toBe(400);
  });

  it('sorts by ending soon (default) or newest, with pagination', async () => {
    const b = await createBusiness();
    const late = await makeOffer(b._id, { title: 'Ends late', validTo: istEndOfDay(day(9)) });
    await new Promise((r) => setTimeout(r, 15));
    await makeOffer(b._id, { title: 'Ends soon', validTo: istEndOfDay(day(1)) });
    await new Promise((r) => setTimeout(r, 15));
    await makeOffer(b._id, { title: 'Newest', validTo: istEndOfDay(day(5)) });
    const titles = async (q) => (await request(app).get('/api/v1/offers').query(q)).body.data.map((o) => o.title);
    expect(await titles({})).toEqual(['Ends soon', 'Newest', 'Ends late']);
    expect(await titles({ sort: 'newest' })).toEqual(['Newest', 'Ends soon', 'Ends late']);
    const p2 = await request(app).get('/api/v1/offers').query({ limit: 2, page: 2 });
    expect(p2.body.data.map((o) => o.id)).toEqual([String(late._id)]);
    expect(p2.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('uses indexes for the public feed', async () => {
    await Offer.init();
    const keys = (await Offer.collection.indexes()).map((i) => Object.keys(i.key).join(','));
    expect(keys).toEqual(expect.arrayContaining(['status,validTo', 'businessId', '_fts,_ftsx', 'businessId,status,validTo']));
    const b = await createBusiness();
    await makeOffer(b._id);
    const now = new Date();
    const plan = await Offer.find({ status: 'published', validFrom: { $lte: now }, validTo: { $gte: now } }).sort({ validTo: 1 }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
  });
});

describe('hiding, scheduling and management', () => {
  it('DELETE hides without deleting; the owner still sees it as hidden', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await createBusiness({ ownerId: owner.user._id });
    const o = await makeOffer(b._id);
    await owner.agent.delete(`/api/v1/offers/${o._id}`);
    expect(await Offer.countDocuments({ _id: o._id })).toBe(1);
    expect((await request(app).get(`/api/v1/offers/${o._id}`)).status).toBe(404);
    const mine = await owner.agent.get('/api/v1/offers/mine').query({ businessId: String(b._id) });
    expect(mine.body.data.items[0]).toMatchObject({ displayStatus: 'hidden' });
  });

  it('management list derives draft / live / scheduled / expired / hidden and reports the limit', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await createBusiness({ ownerId: owner.user._id, name: 'My Shop' });
    await makeOffer(b._id, { title: 'L' });
    await makeOffer(b._id, { title: 'D', status: 'draft' });
    await makeOffer(b._id, { title: 'H', status: 'hidden' });
    await makeOffer(b._id, { title: 'S', validFrom: istStartOfDay(day(3)), validTo: istEndOfDay(day(6)) });
    await makeOffer(b._id, { title: 'E', validFrom: istStartOfDay(day(-6)), validTo: istEndOfDay(day(-2)) });
    const res = await owner.agent.get('/api/v1/offers/mine').query({ businessId: String(b._id) });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ business: { name: 'My Shop', status: 'published' }, canCreate: true, limit: 10, activeOrScheduled: 2 });
    const byTitle = Object.fromEntries(res.body.data.items.map((o) => [o.title, o.displayStatus]));
    expect(byTitle).toEqual({ L: 'live', D: 'draft', H: 'hidden', S: 'scheduled', E: 'expired' });
    const user = await loginAs(app, 'user');
    expect((await user.agent.get('/api/v1/offers/mine').query({ businessId: String(b._id) })).status).toBe(403);
  });

  it('scheduled offers are not public before their start date', async () => {
    const b = await createBusiness();
    const o = await makeOffer(b._id, { validFrom: istStartOfDay('2027-01-10'), validTo: istEndOfDay('2027-01-20') });
    await expect(getOffer(o._id, null, new Date('2027-01-09T23:59:59+05:30'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const ids = async (now) => (await listPublic({ page: 1, limit: 20 }, now)).items.map((x) => x.id);
    expect(await ids(new Date('2027-01-09T23:59:59+05:30'))).toEqual([]);
    expect(await ids(new Date('2027-01-10T00:00:00+05:30'))).toEqual([String(o._id)]);
  });
});

describe('limit of 10 live or scheduled offers per business', () => {
  it('blocks the 11th live/scheduled offer; drafts, hidden and expired do not count', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await createBusiness({ ownerId: owner.user._id });
    for (let i = 0; i < OFFER_LIMIT_PER_BUSINESS - 1; i += 1) await makeOffer(b._id, { title: `Live ${i}` });
    await makeOffer(b._id, { title: 'Scheduled', validFrom: istStartOfDay(day(3)), validTo: istEndOfDay(day(8)) });
    await makeOffer(b._id, { title: 'Hidden', status: 'hidden' });
    await makeOffer(b._id, { title: 'Expired', validFrom: istStartOfDay(day(-8)), validTo: istEndOfDay(day(-2)) });

    const over = await owner.agent.post('/api/v1/offers').send(body(b._id));
    expect(over.status).toBe(409);
    const draft = await owner.agent.post('/api/v1/offers').send(body(b._id, { status: 'draft' }));
    expect(draft.status).toBe(201);
    expect((await owner.agent.patch(`/api/v1/offers/${draft.body.data.id}`).send({ status: 'published' })).status).toBe(409);
    const hiddenOne = await Offer.findOne({ title: 'Hidden' });
    expect((await owner.agent.patch(`/api/v1/offers/${hiddenOne._id}`).send({ status: 'published' })).status).toBe(409);

    // hiding one frees a slot
    const live0 = await Offer.findOne({ title: 'Live 0' });
    await owner.agent.delete(`/api/v1/offers/${live0._id}`);
    expect((await owner.agent.patch(`/api/v1/offers/${draft.body.data.id}`).send({ status: 'published' })).status).toBe(200);
    expect(await Offer.countDocuments({ businessId: b._id, status: 'published', validTo: { $gte: new Date() } })).toBe(10);
  });

  it('simultaneous requests cannot push a business past the limit', async () => {
    const { agent } = await loginAs(app, 'admin');
    const b = await createBusiness();
    for (let i = 0; i < OFFER_LIMIT_PER_BUSINESS - 2; i += 1) await makeOffer(b._id, { title: `Live ${i}` });
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => agent.post('/api/v1/offers').send(body(b._id, { title: `Race ${i}` }))));
    expect(results.filter((r) => r.status === 201).length).toBeLessThanOrEqual(2);
    expect(await Offer.countDocuments({ businessId: b._id, status: 'published', validTo: { $gte: new Date() } })).toBeLessThanOrEqual(OFFER_LIMIT_PER_BUSINESS);
  });
});

describe('sample data', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });

  it('sample offers are refused in production', async () => {
    enterProductionEnv();
    await expect(seedOffers([], new Map())).rejects.toThrow(/cannot be seeded in production/);
  });

  it('sample offers are created for local development, idempotently', async () => {
    const b = await createBusiness({ slug: 'sample-shop' });
    const list = [{ businessSlug: 'sample-shop', title: 'Demo offer', discountLabel: '10% off', terms: 'Demo terms for testing.', startsInDays: 0, endsInDays: 3 }];
    expect(await seedOffers(list, new Map([['sample-shop', b._id]]))).toEqual({ created: 1, skipped: 0 });
    expect(await seedOffers(list, new Map([['sample-shop', b._id]]))).toEqual({ created: 0, skipped: 1 });
    expect((await Offer.findOne({ title: 'Demo offer' }).lean()).isSeed).toBe(true);
  });
});
