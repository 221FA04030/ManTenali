/**
 * Final review tests for Step 5: publishing lifecycle, concurrency safety of
 * the 10-offer limit, and date-only handling (IST / UTC / DST time zones).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb } from '../../tests/helpers.js';
import { loginAs, createBusiness } from '../../tests/factories.js';
import { Offer, OFFER_LIMIT_PER_BUSINESS } from './offers.model.js';
import { listPublic, getOffer, displayStatus } from './offers.service.js';
import { istStartOfDay, istEndOfDay, toIstDate, istToday, addOneYear, isIsoDate } from '../../common/utils/dates.js';

let app;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

const DAY = 86_400_000;
const day = (n) => toIstDate(new Date(Date.now() + n * DAY));
const body = (businessId, o = {}) => ({
  businessId: String(businessId),
  title: 'Diwali sale',
  discountLabel: '25% off',
  terms: 'Valid on all items, one use per customer.',
  validFrom: day(0),
  validTo: day(7),
  ...o,
});
const publicIds = async (now) => (await listPublic({ page: 1, limit: 50 }, now)).items.map((o) => o.id);
const activeCount = (businessId) => Offer.countDocuments({ businessId, status: 'published', validTo: { $gte: new Date() } });

describe('publishing lifecycle: draft -> published -> scheduled / live / expired', () => {
  it('moves through every state; edits keep the published state; hidden never becomes public by itself', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await createBusiness({ ownerId: owner.user._id });

    // 1. draft: private
    const draft = await owner.agent.post('/api/v1/offers').send(body(b._id, { status: 'draft' }));
    const id = draft.body.data.id;
    expect(draft.body.data.displayStatus).toBe('draft');
    expect(await publicIds(new Date())).toEqual([]);

    // 2. publish -> live and public
    const live = await owner.agent.patch(`/api/v1/offers/${id}`).send({ status: 'published' });
    expect(live.body.data.displayStatus).toBe('live');
    expect(await publicIds(new Date())).toEqual([id]);

    // 3. editing a published offer keeps it published and public
    const edited = await owner.agent.patch(`/api/v1/offers/${id}`).send({ title: 'Diwali mega sale', discountLabel: '30% off' });
    expect(edited.body.data).toMatchObject({ status: 'published', displayStatus: 'live', title: 'Diwali mega sale' });
    expect((await request(app).get(`/api/v1/offers/${id}`)).status).toBe(200);

    // 4. moving the dates into the future -> scheduled, not public until the start date (IST)
    const later = await owner.agent.patch(`/api/v1/offers/${id}`).send({ validFrom: day(3), validTo: day(9) });
    expect(later.body.data.displayStatus).toBe('scheduled');
    expect(await publicIds(new Date())).toEqual([]);
    expect(await publicIds(istStartOfDay(day(3)))).toEqual([id]); // goes live by itself at 00:00 IST
    expect(await publicIds(new Date(istStartOfDay(day(3)).getTime() - 1))).toEqual([]);

    // 5. after the end date -> expired, not public
    const afterEnd = new Date(istEndOfDay(day(9)).getTime() + 1);
    expect(await publicIds(istEndOfDay(day(9)))).toEqual([id]); // last millisecond of the end date
    expect(await publicIds(afterEnd)).toEqual([]);
    expect(displayStatus(await Offer.findById(id).lean(), afterEnd)).toBe('expired');

    // 6. hide -> never public again by itself: not after edits, not when its dates come round
    await owner.agent.delete(`/api/v1/offers/${id}`);
    const hiddenEdit = await owner.agent.patch(`/api/v1/offers/${id}`).send({ title: 'Edited while hidden', validFrom: day(0), validTo: day(5) });
    expect(hiddenEdit.body.data).toMatchObject({ status: 'hidden', displayStatus: 'hidden' });
    for (const when of [new Date(), istStartOfDay(day(0)), istEndOfDay(day(5))]) expect(await publicIds(when)).toEqual([]);
    expect((await request(app).get(`/api/v1/offers/${id}`)).status).toBe(404);

    // 7. only an explicit publish brings it back
    const republished = await owner.agent.patch(`/api/v1/offers/${id}`).send({ status: 'published' });
    expect(republished.body.data.displayStatus).toBe('live');
  });

  it('an expired offer can still be edited when its end date is unchanged; a new end date can’t be in the past', async () => {
    const owner = await loginAs(app, 'owner');
    const b = await createBusiness({ ownerId: owner.user._id });
    const expired = await Offer.create({
      businessId: b._id, title: 'Old offer', discountLabel: '10% off', terms: 'Old terms for testing.',
      validFrom: istStartOfDay(day(-10)), validTo: istEndOfDay(day(-3)), status: 'published',
    });
    // The form re-sends the unchanged dates (this was rejected before the review fix).
    const fix = await owner.agent
      .patch(`/api/v1/offers/${expired._id}`)
      .send({ title: 'Old offer (typo fixed)', validFrom: day(-10), validTo: day(-3) });
    expect(fix.status).toBe(200);
    expect(fix.body.data).toMatchObject({ displayStatus: 'expired', validToDate: day(-3) });
    const otherPast = await owner.agent.patch(`/api/v1/offers/${expired._id}`).send({ validTo: day(-1) });
    expect(otherPast.status).toBe(400);
    const extended = await owner.agent.patch(`/api/v1/offers/${expired._id}`).send({ validTo: day(4) });
    expect(extended.body.data.displayStatus).toBe('live');
  });
});

describe('10-offer limit under concurrency', () => {
  it('many simultaneous creates never leave more than 10 live/scheduled offers', async () => {
    const { agent } = await loginAs(app, 'admin');
    for (let round = 0; round < 3; round += 1) {
      const b = await createBusiness();
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => agent.post('/api/v1/offers').send(body(b._id, { title: `Rush ${round}-${i}`, status: 'published' }))),
      );
      const accepted = results.filter((r) => r.status === 201).length;
      expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(true);
      expect(accepted).toBeLessThanOrEqual(OFFER_LIMIT_PER_BUSINESS);
      expect(await activeCount(b._id)).toBe(accepted); // every accepted offer exists, every rejected one doesn't count
    }
  });

  it('many simultaneous publishes of drafts never exceed 10', async () => {
    const { agent } = await loginAs(app, 'admin');
    const b = await createBusiness();
    const drafts = [];
    for (let i = 0; i < 15; i += 1) {
      drafts.push(
        await Offer.create({
          businessId: b._id, title: `Draft ${i}`, discountLabel: 'Deal', terms: 'Terms for testing.',
          validFrom: istStartOfDay(day(0)), validTo: istEndOfDay(day(5)), status: 'draft',
        }),
      );
    }
    const results = await Promise.all(drafts.map((d) => agent.patch(`/api/v1/offers/${d._id}`).send({ status: 'published' })));
    const accepted = results.filter((r) => r.status === 200).length;
    expect(accepted).toBeLessThanOrEqual(OFFER_LIMIT_PER_BUSINESS);
    expect(await activeCount(b._id)).toBe(accepted);
    // rejected publishes were rolled back to drafts
    expect(await Offer.countDocuments({ businessId: b._id, status: 'draft' })).toBe(15 - accepted);
  });

  it('mixed simultaneous creates and publishes near the limit stay within 10', async () => {
    const { agent } = await loginAs(app, 'admin');
    const b = await createBusiness();
    for (let i = 0; i < 8; i += 1) {
      await Offer.create({
        businessId: b._id, title: `Live ${i}`, discountLabel: 'Deal', terms: 'Terms for testing.',
        validFrom: istStartOfDay(day(0)), validTo: istEndOfDay(day(5)), status: 'published',
      });
    }
    const drafts = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        Offer.create({
          businessId: b._id, title: `Draft ${i}`, discountLabel: 'Deal', terms: 'Terms for testing.',
          validFrom: istStartOfDay(day(1)), validTo: istEndOfDay(day(5)), status: 'draft',
        }),
      ),
    );
    await Promise.all([
      ...drafts.map((d) => agent.patch(`/api/v1/offers/${d._id}`).send({ status: 'published' })),
      ...Array.from({ length: 4 }, (_, i) => agent.post('/api/v1/offers').send(body(b._id, { title: `New ${i}`, status: 'published' }))),
    ]);
    expect(await activeCount(b._id)).toBeLessThanOrEqual(OFFER_LIMIT_PER_BUSINESS);
  });
});

describe('date-only handling (IST, UTC, DST time zones)', () => {
  const savedTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = savedTz;
  });

  // Shared with the client test (lib/dates.test.js) so both sides agree.
  const VECTORS = [
    ['2026-11-30', '2026-11-29T18:30:00.000Z', '2026-11-30T18:29:59.999Z'],
    ['2026-12-31', '2026-12-30T18:30:00.000Z', '2026-12-31T18:29:59.999Z'], // year end
    ['2028-02-29', '2028-02-28T18:30:00.000Z', '2028-02-29T18:29:59.999Z'], // leap day
    ['2026-03-08', '2026-03-07T18:30:00.000Z', '2026-03-08T18:29:59.999Z'], // US DST starts
    ['2026-10-25', '2026-10-24T18:30:00.000Z', '2026-10-25T18:29:59.999Z'], // EU DST ends
  ];

  it('start/end of an IST date are fixed UTC instants, whatever the server time zone', () => {
    for (const tz of ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Pacific/Auckland']) {
      process.env.TZ = tz;
      for (const [date, start, end] of VECTORS) {
        expect(istStartOfDay(date).toISOString()).toBe(start);
        expect(istEndOfDay(date).toISOString()).toBe(end);
        expect(toIstDate(istStartOfDay(date))).toBe(date);
        expect(toIstDate(istEndOfDay(date))).toBe(date);
      }
      // IST "today" flips at 18:30 UTC
      expect(istToday(new Date('2026-11-25T18:29:59Z'))).toBe('2026-11-25');
      expect(istToday(new Date('2026-11-25T18:30:00Z'))).toBe('2026-11-26');
    }
  });

  it('one-year rule and calendar validity (leap years, month ends)', () => {
    expect(addOneYear('2026-11-25')).toBe('2027-11-25');
    expect(addOneYear('2028-02-29')).toBe('2029-03-01');
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-04-31')).toBe(false);
  });

  it('a one-day offer is valid for exactly that IST day, and the API echoes the same dates', async () => {
    const { agent } = await loginAs(app, 'admin');
    const b = await createBusiness();
    const res = await agent.post('/api/v1/offers').send(body(b._id, { validFrom: day(2), validTo: day(2), status: 'published' }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ validFromDate: day(2), validToDate: day(2), displayStatus: 'scheduled' });
    const id = res.body.data.id;
    const start = istStartOfDay(day(2));
    const end = istEndOfDay(day(2));
    expect(end.getTime() - start.getTime()).toBe(DAY - 1);
    await expect(getOffer(id, null, new Date(start.getTime() - 1))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getOffer(id, null, start)).resolves.toMatchObject({ validToDate: day(2) });
    await expect(getOffer(id, null, end)).resolves.toBeTruthy();
    await expect(getOffer(id, null, new Date(end.getTime() + 1))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('server and client apply the same date rules (shared table)', async () => {
    const { agent } = await loginAs(app, 'admin');
    const b = await createBusiness();
    // [start, end, expected] relative to today; mirrors client OfferForm validateOffer
    const cases = [
      [0, 0, 201],
      [0, 364, 201],
      [5, 4, 400], // end before start
      [-5, -1, 400], // end in the past
      [-3, 2, 201], // already running
    ];
    for (const [s, e, status] of cases) {
      const res = await agent.post('/api/v1/offers').send(body(b._id, { title: `Case ${s}/${e}`, validFrom: day(s), validTo: day(e), status: 'draft' }));
      expect([s, e, res.status]).toEqual([s, e, status]);
    }
    const oneYear = await agent.post('/api/v1/offers').send(body(b._id, { validFrom: day(0), validTo: addOneYear(day(0)), status: 'draft' }));
    expect(oneYear.status).toBe(400);
  });
});
