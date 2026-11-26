import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN, enterProductionEnv } from '../../tests/helpers.js';
import { loginAs, createUser, createCategory, createBusiness } from '../../tests/factories.js';
import { toIstDateTime, istStartOfDay, istEndOfDay, toIstDate } from '../../common/utils/dates.js';
import { resetEnvCache } from '../../config/env.js';

// Fake Cloudinary storage: uploaded private files live in this map.
const files = new Map();
const destroyed = [];
vi.mock('../../common/integrations/cloudinary.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getResource: vi.fn(async ({ publicId }) => files.get(publicId) ?? null),
    destroyAsset: vi.fn(async ({ publicId }) => {
      destroyed.push(publicId);
      files.delete(publicId);
      return true;
    }),
  };
});

const { Event } = await import('./events.model.js');
const { EventEvidence } = await import('./evidence.model.js');
const { seedEvents, listPublic, purgeExpiredEvidence } = await import('./events.service.js');
const { signUpload } = await import('../media/media.service.js');

let app;
let eventCat;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  files.clear();
  destroyed.length = 0;
  eventCat = await createCategory({ type: 'event', slug: 'festivals', name: { en: 'Festivals' } });
});

const DAY = 86_400_000;
const at = (days, hh = '10:00') => `${toIstDate(new Date(Date.now() + days * DAY))}T${hh}`;
let seq = 0;

/** Simulate a private upload into a user's evidence folder. */
function upload(user, overrides = {}) {
  seq += 1;
  const publicId = `mana-tenali/evidence/u_${user._id ?? user.id}/file${seq}`;
  files.set(publicId, { publicId, resourceType: 'image', type: 'private', format: 'jpg', bytes: 200_000, width: 800, height: 600, pages: null, ...overrides, ...(overrides.publicId ? {} : { publicId }) });
  return { publicId: overrides.publicId ?? publicId, kind: 'poster', filename: 'poster.jpg' };
}

const body = (user, o = {}) => ({
  title: 'Sankranti Kite Festival',
  description: 'Kites, music and food stalls.',
  categoryId: String(eventCat._id),
  startAt: at(5, '09:00'),
  endAt: at(5, '18:00'),
  venue: { name: 'Town Grounds', address: 'Bose Road, Tenali', area: 'Bose Road' },
  organizerName: 'Tenali Youth Club',
  evidence: [upload(user)],
  ...o,
});

async function submitAs(role = 'user', o = {}) {
  const session = await loginAs(app, role);
  const res = await session.agent.post('/api/v1/events/submissions').send(body(session.user, o));
  if (res.status !== 201) throw new Error(`submit failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...session, res, id: res.body.data.id, slug: res.body.data.slug };
}

async function publishedEvent(o = {}) {
  return Event.create({
    title: 'Published fair', slug: `fair-${++seq}`, categoryId: eventCat._id, organizerName: 'Org',
    venue: { name: 'Hall', address: 'Main Road', area: 'Main Road' },
    startAt: new Date(Date.now() + 2 * DAY), endAt: new Date(Date.now() + 2 * DAY + 3_600_000), status: 'published', ...o,
  });
}

const PRIVATE_FIELDS = /moderationLog|submittedBy|"review"|evidence|mana-tenali\/evidence|reviewedBy/;

describe('submitting an event (anyone signed in)', () => {
  it('creates a private pending_review submission with evidence; the server sets status and submitter', async () => {
    const { res, user } = await submitAs('user');
    expect(res.body.data).toMatchObject({ status: 'pending_review', source: 'community', revision: 1, canEdit: true, review: null });
    expect(res.body.data.evidence).toHaveLength(1);
    expect(res.body.data.evidence[0]).toMatchObject({ kind: 'poster', filename: 'poster.jpg', format: 'jpg', isImage: true });
    expect(JSON.stringify(res.body)).not.toContain('mana-tenali/evidence'); // no storage ids even for the owner
    const stored = await Event.findById(res.body.data.id).lean();
    expect(String(stored.submittedBy)).toBe(String(user._id));
    expect(stored.moderationLog.map((l) => l.action)).toEqual(['submitted']);
  });

  it('requires sign-in, evidence, and rejects client-set status, submitter, source or review fields', async () => {
    const anon = await request(app).post('/api/v1/events/submissions').set('Origin', TEST_ORIGIN).send({});
    expect(anon.status).toBe(401);
    const { agent, user } = await loginAs(app, 'user');
    expect((await agent.post('/api/v1/events/submissions').send(body(user, { evidence: [] }))).status).toBe(400);
    for (const extra of [{ status: 'published' }, { submittedBy: String(user._id) }, { source: 'admin' }, { review: {} }, { isSeed: true }]) {
      expect((await agent.post('/api/v1/events/submissions').send(body(user, extra))).status).toBe(400);
    }
    const six = Array.from({ length: 6 }, () => upload(user));
    expect((await agent.post('/api/v1/events/submissions').send(body(user, { evidence: six }))).status).toBe(400);
    expect(await Event.countDocuments()).toBe(0);
  });

  it('validates category, linked business and dates (IST, all-day, 90-day cap, already ended)', async () => {
    const { agent, user } = await loginAs(app, 'user');
    const post = (o) => agent.post('/api/v1/events/submissions').send(body(user, o));
    const bizCat = await createCategory({ type: 'business', slug: 'shops' });
    expect((await post({ categoryId: String(bizCat._id) })).status).toBe(400);
    const draftBiz = await createBusiness({ status: 'draft' });
    expect((await post({ businessId: String(draftBiz._id) })).status).toBe(400);
    expect((await post({ startAt: at(5, '18:00'), endAt: at(5, '09:00') })).status).toBe(400);
    expect((await post({ startAt: at(1), endAt: at(95) })).status).toBe(400);
    expect((await post({ startAt: at(-3), endAt: at(-2) })).status).toBe(400);
    expect((await post({ startAt: '2026-02-30T10:00' })).status).toBe(400);
    expect((await post({ bookingUrl: 'http://insecure.example' })).status).toBe(400);

    const liveBiz = await createBusiness({ status: 'published', name: 'Hall Owner' });
    const ok = await post({ allDay: true, startAt: at(4, '15:00'), endAt: at(6, '09:00'), businessId: String(liveBiz._id), location: { lat: 16.24, lng: 80.64 } });
    expect(ok.status).toBe(201);
    const e = await Event.findById(ok.body.data.id).lean();
    expect(e.startAt.toISOString()).toBe(istStartOfDay(at(4).slice(0, 10)).toISOString());
    expect(e.endAt.toISOString()).toBe(istEndOfDay(at(6).slice(0, 10)).toISOString());
    expect(ok.body.data).toMatchObject({ allDay: true, startLocal: `${at(4).slice(0, 10)}T00:00`, endLocal: `${at(6).slice(0, 10)}T23:59` });
  });

  it('limits submissions per day and open submissions per user', async () => {
    const { agent, user } = await loginAs(app, 'user');
    for (let i = 0; i < 3; i += 1) {
      expect((await agent.post('/api/v1/events/submissions').send(body(user, { title: `Event ${i}` }))).status).toBe(201);
    }
    expect((await agent.post('/api/v1/events/submissions').send(body(user, { title: 'Fourth' }))).status).toBe(429);

    const other = await loginAs(app, 'user');
    await Event.insertMany(
      Array.from({ length: 5 }, (_, i) => ({
        title: `Open ${i}`, slug: `open-${i}`, categoryId: eventCat._id, organizerName: 'x', venue: { name: 'v', address: 'aaa', area: 'Bose Road' },
        startAt: new Date(Date.now() + DAY), endAt: new Date(Date.now() + 2 * DAY), status: 'pending_review', source: 'community',
        submittedBy: other.user._id, submittedAt: new Date(Date.now() - 2 * DAY),
      })),
    );
    expect((await other.agent.post('/api/v1/events/submissions').send(body(other.user))).status).toBe(409);
  });
});

describe('evidence upload validation', () => {
  it('accepts only the caller’s own private JPG/PNG/WebP (<=5 MB) or PDF (<=10 MB, <=20 pages); bad files are deleted', async () => {
    const { agent, user } = await loginAs(app, 'user');
    const otherUser = await createUser();
    const post = (evidence) => agent.post('/api/v1/events/submissions').send(body(user, { evidence: [evidence] }));

    expect((await post(upload(otherUser))).status).toBe(400); // someone else's folder
    expect((await post({ publicId: `mana-tenali/evidence/u_${user._id}/never-uploaded`, kind: 'photo' })).status).toBe(400);
    expect((await post({ publicId: `mana-tenali/evidence/u_${user._id}/../u_x/f`, kind: 'photo' })).status).toBe(400);
    const cases = [
      [{ format: 'gif' }, 'Only JPG, PNG, WebP or PDF'],
      [{ format: 'png', bytes: 5 * 1024 * 1024 + 1 }, 'Images can be at most 5 MB'],
      [{ format: 'pdf', bytes: 10 * 1024 * 1024 + 1, pages: 2 }, 'PDF files can be at most 10 MB'],
      [{ format: 'pdf', bytes: 500_000, pages: 21 }, 'at most 20 pages'],
      [{ type: 'upload' }, 'not uploaded correctly'], // a PUBLIC file is never accepted as evidence
    ];
    for (const [over, message] of cases) {
      const item = upload(user, over);
      const res = await post(item);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain(message);
      expect(destroyed).toContain(item.publicId);
    }
    const pdf = upload(user, { format: 'pdf', bytes: 9 * 1024 * 1024, pages: 20 });
    const ok = await post({ ...pdf, kind: 'document', filename: '../../etc/Venue Letter.pdf' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.evidence[0]).toMatchObject({ format: 'pdf', isImage: false, pages: 20, filename: 'Venue Letter.pdf' });
    // the same file can't be attached twice
    expect((await agent.post('/api/v1/events/submissions').send(body(user, { title: 'Again', evidence: [pdf] }))).status).toBe(400);
  });

  it('signs private uploads into the caller’s own folder for any signed-in user', () => {
    const s = signUpload({ id: 'abc123', role: 'user' }, 'event_evidence', 1_700_000_000_000);
    expect(s.params).toMatchObject({ folder: 'mana-tenali/evidence/u_abc123', type: 'private', allowed_formats: 'jpg,jpeg,png,webp,pdf' });
    expect(s.params.public_id).toMatch(/^[a-f0-9]{32}$/);
    expect(s).toMatchObject({ maxBytes: 10 * 1024 * 1024, maxImageBytes: 5 * 1024 * 1024 });
    expect(s.allowedTypes).toContain('application/pdf');
  });
});

describe('public visibility', () => {
  it('only published (and cancelled, until they end) events are public; every other status is 404', async () => {
    const pub = await publishedEvent({ title: 'Public fair', slug: 'public-fair' });
    await publishedEvent({ title: 'Cancelled fair', slug: 'cancelled-fair', status: 'cancelled', cancelReason: 'Heavy rain' });
    for (const status of ['draft', 'pending_review', 'changes_requested', 'rejected', 'withdrawn', 'hidden', 'archived']) {
      await publishedEvent({ title: `Private ${status}`, slug: `private-${status.replace('_', '-')}`, status });
    }
    const list = await request(app).get('/api/v1/events');
    expect(list.body.data.map((e) => e.title).sort()).toEqual(['Cancelled fair', 'Public fair']);
    expect(list.body.data.find((e) => e.title === 'Cancelled fair')).toMatchObject({ isCancelled: true, cancelReason: 'Heavy rain' });
    expect(JSON.stringify(list.body)).not.toMatch(PRIVATE_FIELDS);
    for (const status of ['draft', 'pending-review', 'changes-requested', 'rejected', 'withdrawn', 'hidden', 'archived']) {
      expect((await request(app).get(`/api/v1/events/private-${status}`)).status).toBe(404);
    }
    const detail = await request(app).get('/api/v1/events/public-fair');
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBeUndefined();
    expect(JSON.stringify(detail.body)).not.toMatch(PRIVATE_FIELDS);
    expect(String(pub._id)).toBe(detail.body.data.id);
  });

  it('a fresh submission is never public, even by slug, until approved', async () => {
    const { slug } = await submitAs('user');
    expect((await request(app).get('/api/v1/events')).body.data).toEqual([]);
    expect((await request(app).get(`/api/v1/events/${slug}`)).status).toBe(404);
    const other = await loginAs(app, 'user');
    expect((await other.agent.get(`/api/v1/events/${slug}`)).status).toBe(404);
  });

  it('hides past events by default; includePast shows the last 90 days', async () => {
    await publishedEvent({ title: 'Upcoming' });
    await publishedEvent({ title: 'Ended last week', startAt: new Date(Date.now() - 8 * DAY), endAt: new Date(Date.now() - 7 * DAY) });
    await publishedEvent({ title: 'Ended long ago', startAt: new Date(Date.now() - 200 * DAY), endAt: new Date(Date.now() - 199 * DAY) });
    await publishedEvent({ title: 'Cancelled and over', status: 'cancelled', startAt: new Date(Date.now() - 3 * DAY), endAt: new Date(Date.now() - 2 * DAY) });
    const titles = async (q) => (await request(app).get('/api/v1/events').query(q)).body.data.map((e) => e.title);
    expect(await titles({})).toEqual(['Upcoming']);
    expect(await titles({ includePast: 'true' })).toEqual(['Upcoming', 'Cancelled and over', 'Ended last week']);
  });

  it('filters by date range (overlap, IST), category, area and near me; upcoming sorted by start', async () => {
    const music = await createCategory({ type: 'event', slug: 'music' });
    await publishedEvent({ title: 'Day 3', startAt: istStartOfDay(at(3).slice(0, 10)), endAt: istEndOfDay(at(3).slice(0, 10)) });
    await publishedEvent({ title: 'Days 6-8', startAt: istStartOfDay(at(6).slice(0, 10)), endAt: istEndOfDay(at(8).slice(0, 10)), categoryId: music._id, venue: { name: 'Hall', address: 'x st', area: 'Kothapeta' }, location: { type: 'Point', coordinates: [80.6444, 16.2379] } });
    const titles = async (q) => (await request(app).get('/api/v1/events').query(q)).body.data.map((e) => e.title);
    expect(await titles({})).toEqual(['Day 3', 'Days 6-8']);
    expect(await titles({ from: at(7).slice(0, 10), to: at(10).slice(0, 10) })).toEqual(['Days 6-8']);
    expect(await titles({ from: at(3).slice(0, 10), to: at(3).slice(0, 10) })).toEqual(['Day 3']);
    expect(await titles({ categoryId: String(music._id) })).toEqual(['Days 6-8']);
    expect(await titles({ area: 'Kothapeta' })).toEqual(['Days 6-8']);
    expect(await titles({ lat: 16.2379, lng: 80.6444, radiusKm: 2 })).toEqual(['Days 6-8']);
    expect((await request(app).get('/api/v1/events').query({ from: at(5).slice(0, 10), to: at(4).slice(0, 10) })).status).toBe(400);
    const p = await request(app).get('/api/v1/events').query({ limit: 1, page: 2 });
    expect(p.body.data.map((e) => e.title)).toEqual(['Days 6-8']);
    expect(p.body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  it('a linked business is shown only while it is published', async () => {
    const biz = await createBusiness({ name: 'Venue Owner', status: 'published' });
    await publishedEvent({ slug: 'linked', businessId: biz._id });
    expect((await request(app).get('/api/v1/events/linked')).body.data.business).toMatchObject({ name: 'Venue Owner' });
    const { Business } = await import('../businesses/businesses.model.js');
    await Business.updateOne({ _id: biz._id }, { status: 'hidden' });
    expect((await request(app).get('/api/v1/events/linked')).body.data.business).toBeNull();
  });

  it('uses indexes for the public list', async () => {
    await Event.init();
    const keys = (await Event.collection.indexes()).map((i) => Object.keys(i.key).join(','));
    expect(keys).toEqual(expect.arrayContaining(['status,startAt', 'location', 'categoryId', '_fts,_ftsx', 'slug', 'status,submittedAt']));
    await publishedEvent();
    const plan = await Event.find({ status: { $in: ['published', 'cancelled'] }, endAt: { $gte: new Date() } }).sort({ startAt: 1 }).explain('queryPlanner');
    expect(JSON.stringify(plan)).toMatch(/IXSCAN/);
  });
});

describe('submitter workflow', () => {
  it('lists only my submissions; others get 404 on read, edit, withdraw and evidence', async () => {
    const mine = await submitAs('user');
    const theirs = await submitAs('user', { title: 'Their event' });
    const list = await mine.agent.get('/api/v1/events/submissions/mine');
    expect(list.body.data.map((e) => e.title)).toEqual(['Sankranti Kite Festival']);
    const ev = (await theirs.agent.get(`/api/v1/events/submissions/${theirs.id}`)).body.data.evidence[0];
    for (const [method, path, payload] of [
      ['get', `/api/v1/events/submissions/${theirs.id}`],
      ['patch', `/api/v1/events/submissions/${theirs.id}`, { title: 'Hijacked title' }],
      ['post', `/api/v1/events/submissions/${theirs.id}/withdraw`],
      ['post', `/api/v1/events/submissions/${theirs.id}/evidence`, upload(mine.user)],
      ['delete', `/api/v1/events/submissions/${theirs.id}/evidence/${ev.id}`],
      ['post', `/api/v1/events/submissions/${theirs.id}/evidence/${ev.id}/access`],
    ]) {
      const res = await mine.agent[method](path).send(payload);
      expect([path, res.status]).toEqual([path, 404]);
    }
    expect((await Event.findById(theirs.id).lean()).title).toBe('Their event');
  });

  it('edits while pending (stays pending); withdraw is final', async () => {
    const { agent, id } = await submitAs('user');
    const edit = await agent.patch(`/api/v1/events/submissions/${id}`).send({ title: 'Sankranti Kite Festival 2027', priceInfo: 'Free' });
    expect(edit.body.data).toMatchObject({ status: 'pending_review', title: 'Sankranti Kite Festival 2027', priceInfo: 'Free' });
    expect((await agent.patch(`/api/v1/events/submissions/${id}`).send({ status: 'published' })).status).toBe(400);
    const w = await agent.post(`/api/v1/events/submissions/${id}/withdraw`);
    expect(w.body.data.status).toBe('withdrawn');
    expect((await agent.patch(`/api/v1/events/submissions/${id}`).send({ title: 'Too late now' })).status).toBe(409);
    expect((await agent.post(`/api/v1/events/submissions/${id}/withdraw`)).status).toBe(409);
  });

  it('adds, replaces and removes evidence (max 5, at least 1 kept; removed files are deleted)', async () => {
    const { agent, id, user } = await submitAs('user');
    const first = (await agent.get(`/api/v1/events/submissions/${id}`)).body.data.evidence[0];
    expect((await agent.delete(`/api/v1/events/submissions/${id}/evidence/${first.id}`)).status).toBe(409); // last one
    const added = await agent.post(`/api/v1/events/submissions/${id}/evidence`).send({ ...upload(user, { format: 'png' }), kind: 'venue_confirmation', note: 'Hall booking receipt' });
    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({ kind: 'venue_confirmation', note: 'Hall booking receipt' });
    const firstRecord = await EventEvidence.findById(first.id).lean();
    const removed = await agent.delete(`/api/v1/events/submissions/${id}/evidence/${first.id}`);
    expect(removed.body.data.status).toBe('removed');
    expect(destroyed).toContain(firstRecord.storage.publicId);
    expect(await EventEvidence.countDocuments({ eventId: id })).toBe(2); // record kept for the audit trail
    for (let i = 0; i < 4; i += 1) await agent.post(`/api/v1/events/submissions/${id}/evidence`).send(upload(user));
    expect((await agent.post(`/api/v1/events/submissions/${id}/evidence`).send(upload(user))).status).toBe(409);
  });

  it('evidence access: short-lived private links for the submitter and admins only, never cached', async () => {
    const { agent, id, user } = await submitAs('user');
    await agent.post(`/api/v1/events/submissions/${id}/evidence`).send({ ...upload(user, { format: 'pdf', pages: 3 }), kind: 'document' });
    const [img, pdf] = (await agent.get(`/api/v1/events/submissions/${id}`)).body.data.evidence;
    const res = await agent.post(`/api/v1/events/submissions/${id}/evidence/${img.id}/access`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.previewUrl).toMatch(/^https:\/\/api\.cloudinary\.com\/v1_1\/test-cloud\/image\/download\?/);
    expect(res.body.data.downloadUrl).toMatch(/type=private/);
    expect(res.body.data.downloadUrl).toMatch(/attachment=true/);
    expect(res.body.data.downloadUrl).toMatch(/expires_at=\d+/);
    expect(new Date(res.body.data.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(300_000);
    const pdfRes = await agent.post(`/api/v1/events/submissions/${id}/evidence/${pdf.id}/access`);
    expect(pdfRes.body.data).toMatchObject({ isImage: false, previewUrl: null }); // PDFs are never displayed inline
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.post(`/api/v1/events/submissions/${id}/evidence/${img.id}/access`)).status).toBe(200);
    const anon = await request(app).post(`/api/v1/events/submissions/${id}/evidence/${img.id}/access`).set('Origin', TEST_ORIGIN);
    expect(anon.status).toBe(401);
  });
});

describe('admin moderation', () => {
  it('only admins can see the queue and review', async () => {
    const { id } = await submitAs('user');
    for (const role of ['user', 'owner']) {
      const { agent } = await loginAs(app, role);
      expect((await agent.get('/api/v1/admin/event-submissions')).status).toBe(403);
      expect((await agent.post(`/api/v1/admin/event-submissions/${id}/approve`).send({})).status).toBe(403);
      expect((await agent.post(`/api/v1/events`).send({})).status).toBe(403);
    }
  });

  it('approve publishes; history, reviewer and timestamps are recorded', async () => {
    const sub = await submitAs('user');
    const admin = await loginAs(app, 'admin');
    const queue = await admin.agent.get('/api/v1/admin/event-submissions');
    expect(queue.body.data.map((e) => e.id)).toEqual([sub.id]);
    expect(queue.body.data[0].submitter).toMatchObject({ email: sub.user.email });
    const banner = { url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/events/b.jpg', publicId: 'mana-tenali/events/b' };
    const res = await admin.agent.post(`/api/v1/admin/event-submissions/${sub.id}/approve`).send({ bannerImage: banner });
    expect(res.body.data).toMatchObject({ status: 'published', review: { outcome: 'approved', reviewedBy: admin.user.name }, bannerImage: banner });
    expect(res.body.data.moderationLog.map((l) => [l.action, l.toStatus])).toEqual([['submitted', 'pending_review'], ['approved', 'published']]);
    expect(res.body.data.moderationLog[1].actor).toBe(admin.user.name);
    expect((await request(app).get(`/api/v1/events/${sub.slug}`)).status).toBe(200);
    expect((await admin.agent.post(`/api/v1/admin/event-submissions/${sub.id}/approve`).send({})).status).toBe(409);
  });

  it('request changes -> submitter edits and resubmits -> back in the queue (revision 2, original place kept)', async () => {
    const sub = await submitAs('user');
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.post(`/api/v1/admin/event-submissions/${sub.id}/request-changes`).send({})).status).toBe(400);
    const rc = await admin.agent.post(`/api/v1/admin/event-submissions/${sub.id}/request-changes`).send({ note: 'Please add the venue confirmation.' });
    expect(rc.body.data.status).toBe('changes_requested');
    const mine = await sub.agent.get(`/api/v1/events/submissions/${sub.id}`);
    expect(mine.body.data.review).toMatchObject({ outcome: 'changes_requested', note: 'Please add the venue confirmation.' });
    expect(mine.body.data.review.reviewedBy).toBeUndefined();
    await sub.agent.post(`/api/v1/events/submissions/${sub.id}/evidence`).send({ ...upload(sub.user), kind: 'venue_confirmation' });
    const re = await sub.agent.post(`/api/v1/events/submissions/${sub.id}/resubmit`);
    expect(re.body.data).toMatchObject({ status: 'pending_review', revision: 2 });
    const stored = await Event.findById(sub.id).lean();
    expect(stored.submittedAt.getTime()).toBeLessThan(stored.lastSubmittedAt.getTime());
    expect((await sub.agent.post(`/api/v1/events/submissions/${sub.id}/resubmit`)).status).toBe(409);
    const queue = await admin.agent.get('/api/v1/admin/event-submissions');
    expect(queue.body.data[0]).toMatchObject({ id: sub.id, revision: 2 });
  });

  it('reject needs a reason, is final, and the submitter sees it', async () => {
    const sub = await submitAs('user');
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.post(`/api/v1/admin/event-submissions/${sub.id}/reject`).send({ reason: 'no' })).status).toBe(400);
    const res = await admin.agent.post(`/api/v1/admin/event-submissions/${sub.id}/reject`).send({ reason: 'Could not verify the venue booking.' });
    expect(res.body.data.status).toBe('rejected');
    expect((await sub.agent.get('/api/v1/events/submissions/mine')).body.data[0].review.note).toBe('Could not verify the venue booking.');
    expect((await sub.agent.patch(`/api/v1/events/submissions/${sub.id}`).send({ title: 'Try again title' })).status).toBe(409);
    expect((await admin.agent.post(`/api/v1/admin/event-submissions/${sub.id}/approve`).send({})).status).toBe(409);
    expect((await request(app).get(`/api/v1/events/${sub.slug}`)).status).toBe(404);
  });

  it('review page shows evidence (including removed), submitter contact and history', async () => {
    const sub = await submitAs('user');
    await sub.agent.post(`/api/v1/events/submissions/${sub.id}/evidence`).send(upload(sub.user));
    const [first] = (await sub.agent.get(`/api/v1/events/submissions/${sub.id}`)).body.data.evidence;
    await sub.agent.delete(`/api/v1/events/submissions/${sub.id}/evidence/${first.id}`);
    const admin = await loginAs(app, 'admin');
    const res = await admin.agent.get(`/api/v1/admin/event-submissions/${sub.id}`);
    expect(res.body.data.submitter).toMatchObject({ name: sub.user.name, email: sub.user.email });
    expect(res.body.data.evidence.map((e) => e.status)).toEqual(['removed', 'active']);
    expect(res.body.data.moderationLog.map((l) => l.action)).toEqual(['submitted', 'evidence_added', 'evidence_removed']);
    expect(JSON.stringify(res.body)).not.toContain('mana-tenali/evidence');
  });
});

describe('admin event management (FR-EVT-3)', () => {
  const adminBody = (o = {}) => ({
    title: 'Ugadi Celebrations', categoryId: String(eventCat._id), startAt: at(10, '17:00'), endAt: at(10, '21:00'),
    venue: { name: 'Temple Grounds', address: 'Main Road', area: 'Main Road' }, organizerName: 'Temple Committee', ...o,
  });

  it('creates, cancels (with reason), hides, restores and removes (soft)', async () => {
    const { agent } = await loginAs(app, 'admin');
    const draft = await agent.post('/api/v1/events').send(adminBody());
    expect(draft.body.data).toMatchObject({ status: 'draft', source: 'admin' });
    const id = draft.body.data.id;
    const slug = draft.body.data.slug;
    expect((await request(app).get(`/api/v1/events/${slug}`)).status).toBe(404);
    expect((await agent.patch(`/api/v1/events/${id}`).send({ status: 'published' })).body.data.status).toBe('published');
    const cancel = await agent.patch(`/api/v1/events/${id}`).send({ status: 'cancelled', cancelReason: 'Postponed due to rain' });
    expect(cancel.body.data.status).toBe('cancelled');
    expect((await request(app).get(`/api/v1/events/${slug}`)).body.data).toMatchObject({ isCancelled: true, cancelReason: 'Postponed due to rain' });
    expect((await agent.patch(`/api/v1/events/${id}`).send({ status: 'hidden' })).body.data.status).toBe('hidden');
    expect((await request(app).get(`/api/v1/events/${slug}`)).status).toBe(404);
    const restored = await agent.patch(`/api/v1/events/${id}`).send({ status: 'published' });
    expect(restored.body.data).toMatchObject({ status: 'published', isCancelled: false });
    const del = await agent.delete(`/api/v1/events/${id}`);
    expect(del.body.data).toEqual({ id, status: 'archived' });
    expect(await Event.countDocuments({ _id: id })).toBe(1);
    expect((await agent.patch(`/api/v1/events/${id}`).send({ title: 'After removal' })).status).toBe(409);
    const admin = await agent.get(`/api/v1/admin/events`).query({ status: 'archived' });
    expect(admin.body.data.map((e) => e.id)).toEqual([id]);
  });

  it('keeps an unchanged category that was deactivated later (admin and submitter edits); a changed one must be active', async () => {
    const { Category } = await import('../categories/categories.model.js');
    const { agent } = await loginAs(app, 'admin');
    const created = await agent.post('/api/v1/events').send(adminBody());
    const id = created.body.data.id;
    const sub = await submitAs('user');
    await Category.updateOne({ _id: eventCat._id }, { isActive: false });

    // The edit forms send every field back, including the unchanged category.
    const adminEdit = await agent.patch(`/api/v1/events/${id}`).send({ ...adminBody(), title: 'Ugadi Celebrations 2027', categoryId: String(eventCat._id) });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.data).toMatchObject({ title: 'Ugadi Celebrations 2027', category: { name: { en: 'Festivals' } } });
    const subEdit = await sub.agent.patch(`/api/v1/events/submissions/${sub.id}`).send({ title: 'Sankranti Kite Festival 2027', categoryId: String(eventCat._id) });
    expect(subEdit.status).toBe(200);
    expect(subEdit.body.data.category).toMatchObject({ name: { en: 'Festivals' } });

    const inactive = await createCategory({ type: 'event', slug: 'retired', isActive: false });
    expect((await agent.patch(`/api/v1/events/${id}`).send({ categoryId: String(inactive._id) })).status).toBe(400);
    expect((await sub.agent.patch(`/api/v1/events/submissions/${sub.id}`).send({ categoryId: String(inactive._id) })).status).toBe(400);
    const music = await createCategory({ type: 'event', slug: 'music' });
    expect((await agent.patch(`/api/v1/events/${id}`).send({ categoryId: String(music._id) })).body.data.category).toMatchObject({ slug: 'music' });
    expect((await agent.patch(`/api/v1/events/${id}`).send({ categoryId: String(eventCat._id) })).status).toBe(400);
    expect((await agent.post('/api/v1/events').send(adminBody({ title: 'New with old category' }))).status).toBe(400);
  });

  it('submissions under review can’t change status through PATCH; admin typo fixes are logged', async () => {
    const sub = await submitAs('user');
    const { agent } = await loginAs(app, 'admin');
    expect((await agent.patch(`/api/v1/events/${sub.id}`).send({ status: 'published' })).status).toBe(409);
    const fix = await agent.patch(`/api/v1/events/${sub.id}`).send({ title: 'Sankranti Kite Festival (fixed)' });
    expect(fix.body.data).toMatchObject({ status: 'pending_review', title: 'Sankranti Kite Festival (fixed)' });
    expect(fix.body.data.moderationLog.at(-1).action).toBe('edited_by_admin');
    // admins can preview a non-public event by slug (status included)
    expect((await agent.get(`/api/v1/events/${sub.slug}`)).body.data.status).toBe('pending_review');
  });
});

describe('sample data', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });

  it('is refused in production and idempotent locally', async () => {
    const list = [{ slug: 'sample-x', title: 'Sample X', categorySlug: 'festivals', startsInDays: 2, startHourIst: 18, hours: 2, venue: { name: 'Hall', address: 'Road 1', area: 'Main Road' }, organizerName: 'Demo' }];
    const ids = new Map([['festivals', eventCat._id]]);
    expect(await seedEvents(list, ids)).toEqual({ created: 1, skipped: 0 });
    expect(await seedEvents(list, ids)).toEqual({ created: 0, skipped: 1 });
    const e = await Event.findOne({ slug: 'sample-x' }).lean();
    expect(toIstDateTime(e.startAt).slice(11)).toBe('18:00');
    expect((await listPublic({ page: 1, limit: 5 })).items[0]).toMatchObject({ isSeed: true });
    enterProductionEnv();
    await expect(seedEvents(list, ids)).rejects.toThrow(/cannot be seeded in production/);
  });
});

describe('evidence retention (180 days after the final decision)', () => {
  it('dry run counts, --apply deletes files of decided events only; pending submissions are untouched', async () => {
    const rejected = await submitAs('user');
    const pending = await submitAs('user');
    const admin = await loginAs(app, 'admin');
    await admin.agent.post(`/api/v1/admin/event-submissions/${rejected.id}/reject`).send({ reason: 'Could not verify the venue booking.' });

    const soon = await purgeExpiredEvidence({ apply: true, now: new Date(Date.now() + 179 * DAY) });
    expect(soon).toMatchObject({ events: 0, files: 0 });

    const later = new Date(Date.now() + 181 * DAY);
    expect(await purgeExpiredEvidence({ now: later })).toMatchObject({ events: 1, files: 0, applied: false });
    expect(destroyed).toHaveLength(0);
    expect(await purgeExpiredEvidence({ apply: true, now: later })).toMatchObject({ events: 1, files: 1, applied: true });
    expect(destroyed).toHaveLength(1);
    expect(await EventEvidence.countDocuments({ eventId: rejected.id, status: 'active' })).toBe(0);
    expect(await EventEvidence.countDocuments({ eventId: pending.id, status: 'active' })).toBe(1);
    expect(await purgeExpiredEvidence({ apply: true, now: later })).toMatchObject({ events: 0, files: 0 }); // idempotent
  });
});
