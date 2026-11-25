import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb } from '../../tests/helpers.js';
import { createCategory, createBusiness } from '../../tests/factories.js';
import { Offer } from '../offers/offers.model.js';
import { Event } from '../events/events.model.js';
import { News } from '../news/news.model.js';
import { composeBanner, HOME_LIMITS } from './home.service.js';

let app;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const point = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });

beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);

let eventCat;
let seq = 0;
beforeEach(async () => {
  await clearTestDb();
  eventCat = await createCategory({ type: 'event', slug: 'festivals' });
});

const news = (o = {}) =>
  News.create({
    title: `News ${(seq += 1)}`, slug: `news-${seq}`, summary: 'A short summary for the item.', type: 'news',
    sourceName: 'Municipal office', status: 'published', publishedAt: new Date(Date.now() - seq * 60_000), ...o,
  });
const event = (o = {}) =>
  Event.create({
    title: `Event ${(seq += 1)}`, slug: `event-${seq}`, categoryId: eventCat._id, organizerName: 'Club',
    venue: { name: 'Hall', address: 'Main Road', area: 'Main Road' }, startAt: new Date(Date.now() + DAY),
    endAt: new Date(Date.now() + DAY + 2 * HOUR), status: 'published', ...o,
  });
const offer = (business, o = {}) =>
  Offer.create({
    businessId: business._id, title: `Offer ${(seq += 1)}`, discountLabel: '10% off', terms: 'Terms apply.',
    validFrom: new Date(Date.now() - DAY), validTo: new Date(Date.now() + 3 * DAY), status: 'published', ...o,
  });
const home = (q) => request(app).get('/api/v1/home').query(q ?? {});

describe('GET /home', () => {
  it('works on an empty database (every section empty, banner hidden by the client)', async () => {
    const res = await home();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ banner: [], today: { notices: [], nextEvent: null }, nearby: { mode: 'all', items: [] }, offers: [], events: [], news: [] });
  });

  it('banner: pinned news first (max 3), then next events and offers ending soonest, alternating, up to 5', async () => {
    const b = await createBusiness({ name: 'Padma Meals' });
    for (let i = 0; i < 4; i += 1) await news({ title: `Pinned ${i}`, isPinned: true });
    await news({ title: 'Pinned draft', isPinned: true, status: 'draft' });
    await news({ title: 'Pinned expired', isPinned: true, type: 'power', validUntil: new Date(Date.now() - HOUR) });
    await event({ title: 'Next event', startAt: new Date(Date.now() + HOUR) });
    await event({ title: 'Cancelled event', status: 'cancelled', startAt: new Date(Date.now() + 30 * 60_000) });
    await offer(b, { title: 'Ends tomorrow', validTo: new Date(Date.now() + DAY) });
    await offer(b, { title: 'Ends later', validTo: new Date(Date.now() + 5 * DAY) });
    const res = await home();
    const banner = res.body.data.banner.map((x) => `${x.type}:${x.item.title}`);
    expect(banner).toEqual(['news:Pinned 0', 'news:Pinned 1', 'news:Pinned 2', 'event:Next event', 'offer:Ends tomorrow']);
    expect(res.body.data.banner[4].item.business).toMatchObject({ name: 'Padma Meals' });
  });

  it('banner composition fills with extra pinned news only when events and offers run out', () => {
    const n = (t) => ({ title: t });
    const titles = (list) => list.map((x) => `${x.type}:${x.item.title}`);
    expect(titles(composeBanner([n('a'), n('b'), n('c'), n('d'), n('e')], [], []))).toEqual(['news:a', 'news:b', 'news:c', 'news:d', 'news:e']);
    expect(titles(composeBanner([n('a')], [n('e1'), n('e2'), n('e3')], [n('o1')]))).toEqual(['news:a', 'event:e1', 'offer:o1', 'event:e2', 'event:e3']);
    expect(composeBanner([], [], [])).toEqual([]);
    expect(HOME_LIMITS.banner).toBe(5);
  });

  it('Today in Tenali: latest unexpired notices (not plain news) with source and times, plus the next event', async () => {
    await news({ title: 'Plain news' });
    await news({ title: 'Water cut', type: 'water', validUntil: new Date(Date.now() + 5 * HOUR) });
    await news({ title: 'Traffic diversion', type: 'traffic' });
    await news({ title: 'Old power cut', type: 'power', validUntil: new Date(Date.now() - HOUR) });
    await news({ title: 'Hidden weather', type: 'weather', status: 'hidden' });
    await event({ title: 'Later event', startAt: new Date(Date.now() + 3 * DAY), endAt: new Date(Date.now() + 3 * DAY + HOUR) });
    await event({ title: 'Soonest event', startAt: new Date(Date.now() + HOUR), endAt: new Date(Date.now() + 2 * HOUR) });
    const { today } = (await home()).body.data;
    expect(today.notices.map((x) => x.title)).toEqual(['Water cut', 'Traffic diversion']);
    expect(today.notices[0]).toMatchObject({ sourceName: 'Municipal office', type: 'water', isExpired: false });
    expect(today.notices[0].updatedAt).toBeTruthy();
    expect(today.nextEvent).toMatchObject({ title: 'Soonest event' });
  });

  it('nearby businesses: near me by distance, else the chosen area, falling back to all of Tenali', async () => {
    await createBusiness({ name: 'Far', location: point(16.40, 80.80), address: { line: 'x', area: 'Chinaravuru' } });
    await createBusiness({ name: 'Near', location: point(16.2385, 80.6450), address: { line: 'x', area: 'Kothapeta' } });
    await createBusiness({ name: 'Hidden near', status: 'hidden', location: point(16.2380, 80.6445) });
    const near = (await home({ lat: 16.2379, lng: 80.6444 })).body.data.nearby;
    expect(near.mode).toBe('near');
    expect(near.items.map((b) => b.name)).toEqual(['Near']);
    expect(near.items[0].distanceM).toBeLessThan(200);
    const area = (await home({ area: 'Chinaravuru' })).body.data.nearby;
    expect(area).toMatchObject({ mode: 'area', area: 'Chinaravuru' });
    expect(area.items.map((b) => b.name)).toEqual(['Far']);
    const fallback = (await home({ area: 'Nowhere' })).body.data.nearby;
    expect(fallback.mode).toBe('all');
    expect(fallback.items.map((b) => b.name).sort()).toEqual(['Far', 'Near']);
    expect((await home({ lat: 16.2 })).status).toBe(400);
    expect((await home({ q: 'x' })).status).toBe(400);
  });

  it('sections show only public items: live offers of published businesses, upcoming events, latest plain news', async () => {
    const pub = await createBusiness({ name: 'Open shop' });
    const hidden = await createBusiness({ name: 'Hidden shop', status: 'hidden' });
    await offer(pub, { title: 'Live offer' });
    await offer(hidden, { title: 'Offer of hidden shop' });
    await offer(pub, { title: 'Expired offer', validFrom: new Date(Date.now() - 5 * DAY), validTo: new Date(Date.now() - DAY) });
    await event({ title: 'Upcoming' });
    await event({ title: 'Past', startAt: new Date(Date.now() - 3 * DAY), endAt: new Date(Date.now() - 2 * DAY) });
    await event({ title: 'Draft', status: 'draft' });
    await news({ title: 'Town news' });
    await news({ title: 'A notice', type: 'announcement' });
    const d = (await home()).body.data;
    expect(d.offers.map((o) => o.title)).toEqual(['Live offer']);
    expect(d.events.map((e) => e.title)).toEqual(['Upcoming']);
    expect(d.news.map((n) => n.title)).toEqual(['Town news']);
    expect(JSON.stringify(d)).not.toMatch(/moderationLog|createdBy|updatedBy|submittedBy|Hidden shop|Draft/);
  });
});
