import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb } from '../../tests/helpers.js';
import { loginAs, createBusiness, createCategory } from '../../tests/factories.js';
import { Business } from '../businesses/businesses.model.js';
import { Offer } from '../offers/offers.model.js';
import { Event } from '../events/events.model.js';
import { Favorite, MAX_FAVORITES } from './favorites.model.js';

let app;
const DAY = 86_400_000;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

let seq = 0;
const offer = (business, o = {}) =>
  Offer.create({
    businessId: business._id, title: `Offer ${(seq += 1)}`, discountLabel: '10% off', terms: 'Terms.',
    validFrom: new Date(Date.now() - DAY), validTo: new Date(Date.now() + 3 * DAY), status: 'published', ...o,
  });
const event = async (o = {}) => {
  const cat = await createCategory({ type: 'event', slug: `ev-${(seq += 1)}` });
  return Event.create({
    title: `Event ${seq}`, slug: `event-${seq}`, categoryId: cat._id, organizerName: 'Club', venue: { name: 'Hall', address: 'Road', area: 'Main Road' },
    startAt: new Date(Date.now() + DAY), endAt: new Date(Date.now() + DAY + 3_600_000), status: 'published', ...o,
  });
};

describe('favorites (FR-FAV-1)', () => {
  it('saves public businesses, offers and events and lists them with their cards, newest first', async () => {
    const biz = await createBusiness({ name: 'Padma Meals' });
    const o = await offer(biz, { title: 'Free sweet' });
    const e = await event({ title: 'Food festival' });
    const { agent } = await loginAs(app, 'user');
    for (const [targetType, targetId] of [['business', biz._id], ['offer', o._id], ['event', e._id]]) {
      const res = await agent.post('/api/v1/favorites').send({ targetType, targetId: String(targetId) });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ targetType, targetId: String(targetId) });
    }
    const list = (await agent.get('/api/v1/favorites')).body.data;
    expect(list.map((f) => f.targetType)).toEqual(['event', 'offer', 'business']);
    expect(list.find((f) => f.targetType === 'business').item).toMatchObject({ name: 'Padma Meals', slug: biz.slug });
    expect(list.find((f) => f.targetType === 'offer').item).toMatchObject({ title: 'Free sweet', business: { name: 'Padma Meals' } });
    expect(list.find((f) => f.targetType === 'event').item).toMatchObject({ title: 'Food festival' });
    expect((await agent.post('/api/v1/favorites').send({ targetType: 'business', targetId: String(biz._id) })).status).toBe(409);
  });

  it('only public items can be saved (404 otherwise); bad input is 400; sign-in is required', async () => {
    const hidden = await createBusiness({ status: 'hidden' });
    const pub = await createBusiness();
    const expired = await offer(pub, { validFrom: new Date(Date.now() - 5 * DAY), validTo: new Date(Date.now() - DAY) });
    const ofHidden = await offer(hidden);
    const draft = await event({ status: 'pending_review' });
    const { agent } = await loginAs(app, 'user');
    for (const [targetType, doc] of [['business', hidden], ['offer', expired], ['offer', ofHidden], ['event', draft]]) {
      expect((await agent.post('/api/v1/favorites').send({ targetType, targetId: String(doc._id) })).status).toBe(404);
    }
    expect((await agent.post('/api/v1/favorites').send({ targetType: 'news', targetId: String(pub._id) })).status).toBe(400);
    expect((await agent.post('/api/v1/favorites').send({ targetType: 'business', targetId: 'x' })).status).toBe(400);
    expect((await agent.post('/api/v1/favorites').send({ targetType: 'business', targetId: String(pub._id), userId: 'x' })).status).toBe(400);
    expect((await request(app).get('/api/v1/favorites')).status).toBe(401);
    expect(await Favorite.countDocuments()).toBe(0);
  });

  it('items that stop being public stay listed as unavailable (item: null) so they can be removed', async () => {
    const biz = await createBusiness();
    const { agent } = await loginAs(app, 'user');
    const saved = (await agent.post('/api/v1/favorites').send({ targetType: 'business', targetId: String(biz._id) })).body.data;
    await Business.updateOne({ _id: biz._id }, { status: 'hidden' });
    expect((await agent.get('/api/v1/favorites')).body.data).toEqual([expect.objectContaining({ id: saved.id, item: null })]);
    expect((await agent.delete(`/api/v1/favorites/${saved.id}`)).body.data).toEqual({ id: saved.id, deleted: true });
    expect((await agent.get('/api/v1/favorites')).body.data).toEqual([]);
  });

  it('each user sees and removes only their own saved items', async () => {
    const biz = await createBusiness();
    const a = await loginAs(app, 'user');
    const b = await loginAs(app, 'user');
    const saved = (await a.agent.post('/api/v1/favorites').send({ targetType: 'business', targetId: String(biz._id) })).body.data;
    expect((await b.agent.get('/api/v1/favorites')).body.data).toEqual([]);
    expect((await b.agent.delete(`/api/v1/favorites/${saved.id}`)).status).toBe(404);
    expect(await Favorite.countDocuments()).toBe(1);
  });

  it(`caps saved items at ${MAX_FAVORITES} per user`, async () => {
    const { agent, user } = await loginAs(app, 'user');
    await Favorite.insertMany(Array.from({ length: MAX_FAVORITES }, () => ({ userId: user._id, targetType: 'business', targetId: new Business()._id })));
    const biz = await createBusiness();
    expect((await agent.post('/api/v1/favorites').send({ targetType: 'business', targetId: String(biz._id) })).status).toBe(409);
  });
});
