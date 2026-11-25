import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb } from '../../tests/helpers.js';
import { createCategory, createBusiness } from '../../tests/factories.js';
import { Business } from '../businesses/businesses.model.js';
import { Offer } from '../offers/offers.model.js';
import { Event } from '../events/events.model.js';
import { News } from '../news/news.model.js';

let app;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const TENALI = { lat: 16.2379, lng: 80.6444 };
const point = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });

beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);

let cats;
let seq = 0;
beforeEach(async () => {
  await clearTestDb();
  const food = await createCategory({ type: 'business', slug: 'food-dining', name: { en: 'Food & Dining', te: 'ఆహారం' } });
  const restaurants = await createCategory({ type: 'business', slug: 'restaurants', name: { en: 'Restaurants', te: 'రెస్టారెంట్లు' }, parentId: food._id });
  const shops = await createCategory({ type: 'business', slug: 'shopping', name: { en: 'Shopping' } });
  const festivals = await createCategory({ type: 'event', slug: 'festivals', name: { en: 'Festivals & Culture' } });
  const civic = await createCategory({ type: 'news', slug: 'civic', name: { en: 'Civic & Municipal' } });
  cats = { food, restaurants, shops, festivals, civic };
});

const biz = (o = {}) => {
  seq += 1;
  return createBusiness({ name: `Business ${seq}`, slug: `biz-${seq}`, categoryId: cats.shops._id, location: point(TENALI.lat, TENALI.lng), ...o });
};
const offer = (business, o = {}) =>
  Offer.create({
    businessId: business._id, title: `Offer ${(seq += 1)}`, discountLabel: '10% off', terms: 'Terms apply.',
    validFrom: new Date(Date.now() - DAY), validTo: new Date(Date.now() + 5 * DAY), status: 'published', ...o,
  });
const event = (o = {}) =>
  Event.create({
    title: `Event ${(seq += 1)}`, slug: `event-${seq}`, categoryId: cats.festivals._id, organizerName: 'Town Club',
    venue: { name: 'Town Hall', address: 'Main Road', area: 'Main Road' }, startAt: new Date(Date.now() + 2 * DAY),
    endAt: new Date(Date.now() + 2 * DAY + 3 * HOUR), status: 'published', ...o,
  });
const news = (o = {}) =>
  News.create({
    title: `News ${(seq += 1)}`, slug: `news-${seq}`, summary: 'A short summary for the item.', type: 'news',
    sourceName: 'Municipal office', status: 'published', publishedAt: new Date(Date.now() - HOUR), ...o,
  });

const search = (query) => request(app).get('/api/v1/search').query(query);
const names = (res, type) => (res.body.data.groups[type] ?? []).map((x) => x.name ?? x.title);

describe('GET /search (FR-SRCH-1): one box, grouped results with counts, public items only', () => {
  it('groups businesses, offers, events and news with counts; never returns non-public items', async () => {
    const b = await biz({ name: 'Biryani Point', tags: ['biryani'] });
    await biz({ name: 'Biryani Hidden', status: 'hidden' });
    await biz({ name: 'Biryani Pending', status: 'pending' });
    const hiddenBiz = await biz({ name: 'Plain Shop', status: 'hidden' });
    await offer(b, { title: 'Biryani combo for two' });
    await offer(b, { title: 'Biryani expired deal', validFrom: new Date(Date.now() - 9 * DAY), validTo: new Date(Date.now() - DAY) });
    await offer(b, { title: 'Biryani draft deal', status: 'draft' });
    await offer(hiddenBiz, { title: 'Biryani on a hidden shop' });
    await event({ title: 'Biryani festival' });
    await event({ title: 'Biryani contest (cancelled)', status: 'cancelled', cancelReason: 'Rain' });
    await event({ title: 'Biryani night (past)', startAt: new Date(Date.now() - 3 * DAY), endAt: new Date(Date.now() - 2 * DAY) });
    for (const status of ['draft', 'pending_review', 'hidden', 'rejected', 'archived']) await event({ title: `Biryani ${status}`, status });
    await news({ title: 'Biryani stalls at the fair' });
    await news({ title: 'Biryani notice expired', type: 'power', validUntil: new Date(Date.now() - HOUR) });
    for (const status of ['draft', 'hidden', 'archived']) await news({ title: `Biryani news ${status}`, status });

    const res = await search({ q: 'biryani' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ query: 'biryani', type: 'all', fuzzy: false, counts: { business: 1, offer: 1, event: 2, news: 1, all: 5 } });
    expect(names(res, 'business')).toEqual(['Biryani Point']);
    expect(names(res, 'offer')).toEqual(['Biryani combo for two']);
    expect(names(res, 'event').sort()).toEqual(['Biryani contest (cancelled)', 'Biryani festival']);
    expect(res.body.data.groups.event.find((e) => e.isCancelled)).toMatchObject({ cancelReason: 'Rain' });
    expect(names(res, 'news')).toEqual(['Biryani stalls at the fair']);
    expect(res.body.meta).toBeUndefined();
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/moderationLog|submittedBy|createdBy|updatedBy|"status":"(draft|hidden)/);
  });

  it('matches partial words at word starts, every word, case-insensitively; category names; Telugu; plurals', async () => {
    await biz({ name: 'Sri Lakshmi Sweet Stall', categoryId: cats.food._id, subcategoryId: cats.restaurants._id });
    await biz({ name: 'Ravi Tiffins', categoryId: cats.food._id, subcategoryId: cats.restaurants._id, address: { line: 'x', area: 'Kothapeta' } });
    await biz({ name: 'Mana Tenali Kirana', tags: ['groceries'] });
    await biz({ name: 'తెనాలి స్వీట్స్' });
    const q = async (text) => names(await search({ q: text }), 'business').sort();
    expect(await q('lak')).toEqual(['Sri Lakshmi Sweet Stall']);
    expect(await q('shmi')).toEqual([]); // mid-word: no (and too far from any word start for the typo fallback)
    expect(await q('akshmi')).toEqual(['Sri Lakshmi Sweet Stall']); // one missing first letter: found by the typo fallback
    expect(await q('SWEETS')).toEqual(['Sri Lakshmi Sweet Stall']); // case + plural
    expect(await q('ravi kothapeta')).toEqual(['Ravi Tiffins']); // every word, any field (area)
    expect(await q('ravi shopping')).toEqual([]);
    expect(await q('restaurants')).toEqual(['Ravi Tiffins', 'Sri Lakshmi Sweet Stall']); // subcategory name
    expect(await q('రెస్టారెంట్')).toEqual(['Ravi Tiffins', 'Sri Lakshmi Sweet Stall']); // Telugu category name
    expect(await q('తెనా')).toEqual(['తెనాలి స్వీట్స్']); // Telugu name, partial
    expect(await q('grocer')).toEqual(['Mana Tenali Kirana']); // tag
    expect(await q('.*')).toEqual([]); // regex characters are literal
  });

  it('falls back to close matches (one typo) only when nothing matches exactly', async () => {
    await biz({ name: 'Biryani House' });
    await news({ title: 'Biryani festival this weekend' });
    const typo = await search({ q: 'biriyani' });
    expect(typo.body.data.fuzzy).toBe(true);
    expect(names(typo, 'business')).toEqual(['Biryani House']);
    expect(names(typo, 'news')).toEqual(['Biryani festival this weekend']);
    const exact = await search({ q: 'biryani' });
    expect(exact.body.data.fuzzy).toBe(false);
    const none = await search({ q: 'zzzzqqq' });
    expect(none.body.data).toMatchObject({ fuzzy: true, counts: { all: 0 } });
    const short = await search({ q: 'zq' });
    expect(short.body.data).toMatchObject({ fuzzy: false, counts: { all: 0 } }); // too short for typo tolerance
  });

  it('ranks title matches first and a title that starts with the query highest', async () => {
    await biz({ name: 'Paradise', tags: ['biryani'] });
    await biz({ name: 'Paradise Biryani' });
    await biz({ name: 'Biryani Point' });
    expect(names(await search({ q: 'biryani' }), 'business')).toEqual(['Biryani Point', 'Paradise Biryani', 'Paradise']);
  });
});

describe('GET /search (FR-SRCH-2): tabs, area, distance and pagination', () => {
  it('a single type returns one page with meta; counts still cover every type', async () => {
    for (let i = 0; i < 7; i += 1) await biz({ name: `Kirana Store ${i}` });
    await news({ title: 'Kirana prices update' });
    const all = await search({ q: 'kirana' });
    expect(all.body.data.groups.business).toHaveLength(5); // preview per type
    expect(all.body.data.counts).toMatchObject({ business: 7, news: 1 });
    const p2 = await search({ q: 'kirana', type: 'business', limit: 3, page: 3 });
    expect(Object.keys(p2.body.data.groups)).toEqual(['business']);
    expect(p2.body.data.groups.business).toHaveLength(1);
    expect(p2.body.meta).toEqual({ page: 3, limit: 3, total: 7, totalPages: 3, capped: false });
    expect(p2.body.data.counts).toMatchObject({ business: 7, news: 1, all: 8 });
  });

  it('filters by area (businesses, events, offers via their business); news is town-wide', async () => {
    const a = await biz({ name: 'Kothapeta Kirana', address: { line: 'x', area: 'Kothapeta' } });
    const b = await biz({ name: 'Main Road Kirana', address: { line: 'y', area: 'Main Road' } });
    await offer(a, { title: 'Kirana savings week' });
    await offer(b, { title: 'Kirana festival offer' });
    await event({ title: 'Kirana traders meet', venue: { name: 'Hall', address: 'z', area: 'Kothapeta' } });
    await event({ title: 'Kirana expo', venue: { name: 'Hall', address: 'z', area: 'Main Road' } });
    await news({ title: 'Kirana prices update' });
    const res = await search({ q: 'kirana', area: 'Kothapeta' });
    expect(names(res, 'business')).toEqual(['Kothapeta Kirana']);
    expect(names(res, 'offer')).toEqual(['Kirana savings week']);
    expect(names(res, 'event')).toEqual(['Kirana traders meet']);
    expect(names(res, 'news')).toEqual(['Kirana prices update']);
  });

  it('near me keeps results within the radius and can sort by distance (distanceM returned)', async () => {
    await biz({ name: 'Kirana Far', location: point(16.30, 80.70) }); // ~9 km
    await biz({ name: 'Kirana Near', location: point(16.2385, 80.6450) }); // ~90 m
    await biz({ name: 'Kirana Mid', location: point(16.2479, 80.6444) }); // ~1.1 km
    await event({ title: 'Kirana fair', location: point(16.2400, 80.6444) });
    await event({ title: 'Kirana talk (no map point)' });
    const near = await search({ q: 'kirana', lat: TENALI.lat, lng: TENALI.lng, radiusKm: 5, sort: 'distance', type: 'business' });
    expect(names(near, 'business')).toEqual(['Kirana Near', 'Kirana Mid']);
    expect(near.body.data.groups.business[0].distanceM).toBeLessThan(200);
    const wide = await search({ q: 'kirana', lat: TENALI.lat, lng: TENALI.lng, radiusKm: 20, sort: 'distance' });
    expect(names(wide, 'business')).toEqual(['Kirana Near', 'Kirana Mid', 'Kirana Far']);
    expect(names(wide, 'event')).toEqual(['Kirana fair']); // events without a map point can't be "near"
  });

  it('validates input', async () => {
    expect((await search({})).status).toBe(400);
    expect((await search({ q: 'a' })).status).toBe(400);
    expect((await search({ q: 'x'.repeat(101) })).status).toBe(400);
    expect((await search({ q: 'kirana', type: 'people' })).status).toBe(400);
    expect((await search({ q: 'kirana', sort: 'distance' })).status).toBe(400); // needs a location
    expect((await search({ q: 'kirana', lat: 16.2 })).status).toBe(400);
    expect((await search({ q: 'kirana', limit: 51 })).status).toBe(400);
    expect((await search({ q: 'kirana', unknown: 1 })).status).toBe(400);
    expect((await search({ q: '!!' })).status).toBe(400); // nothing searchable left
  });

  it('uses indexes for the candidate queries', async () => {
    await biz({ name: 'Kirana One' });
    const plan = await Business.find({ status: 'published', name: { $regex: '(?:^|\\s)kirana', $options: 'i' } })
      .sort({ isVerified: -1, ratingAvg: -1, updatedAt: -1 })
      .explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
    const newsPlan = await News.find({ status: 'published', title: { $regex: 'x' } }).sort({ isPinned: -1, publishedAt: -1 }).explain('queryPlanner');
    expect(JSON.stringify(newsPlan)).toMatch(/IXSCAN/);
  });
});

describe('GET /search/suggest (FR-SRCH-3)', () => {
  it('suggests published business names and active business categories', async () => {
    await biz({ name: 'Ravi Tiffins', slug: 'ravi-tiffins' });
    await biz({ name: 'Ravi Hidden Tiffins', status: 'hidden' });
    await createCategory({ type: 'business', slug: 'tiffin-centres', name: { en: 'Tiffin Centres' }, parentId: cats.food._id });
    await createCategory({ type: 'business', slug: 'old-tiffins', name: { en: 'Tiffin Old' }, isActive: false });
    await createCategory({ type: 'event', slug: 'tiffin-event', name: { en: 'Tiffin Event' } });
    const res = await request(app).get('/api/v1/search/suggest').query({ q: 'tiff' });
    expect(res.status).toBe(200);
    expect(res.body.data.businesses).toEqual([{ id: expect.any(String), name: 'Ravi Tiffins', slug: 'ravi-tiffins', area: 'Main Road' }]);
    expect(res.body.data.categories).toEqual([expect.objectContaining({ name: { en: 'Tiffin Centres', te: null }, parentId: String(cats.food._id) })]);
    expect((await request(app).get('/api/v1/search/suggest').query({ q: 'x' })).status).toBe(400);
  });
});
