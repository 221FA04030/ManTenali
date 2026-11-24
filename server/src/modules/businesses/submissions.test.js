import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp, connectTestDb, disconnectTestDb, clearTestDb, TEST_ORIGIN } from '../../tests/helpers.js';
import { loginAs, createCategory, createBusiness } from '../../tests/factories.js';
import { Business } from './businesses.model.js';
import { User } from '../users/users.model.js';
import { assertPublished, getPublishedIds, migrateCategoryReferences, SUBMISSION_LIMITS } from './businesses.service.js';

let app;
let food;
let tiffin;
let shopping;
beforeAll(async () => {
  await connectTestDb();
  app = buildTestApp();
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  food = await createCategory({ slug: 'food-dining', name: { en: 'Food & Dining' } });
  tiffin = await createCategory({ slug: 'tiffin-centres', name: { en: 'Tiffin Centres' }, parentId: food._id });
  shopping = await createCategory({ slug: 'shopping', name: { en: 'Shopping' } });
});

const photo = (id = 'p1') => ({
  url: `https://res.cloudinary.com/test-cloud/image/upload/v1/mana-tenali/businesses/${id}.jpg`,
  publicId: `mana-tenali/businesses/${id}`,
});

const submission = (overrides = {}) => ({
  name: 'Lakshmi Tiffins',
  categoryId: String(food._id),
  subcategoryId: String(tiffin._id),
  description: 'Idli, dosa and pesarattu',
  address: { line: 'Near Clock Tower', area: 'Bose Road', pincode: '522201' },
  location: { lat: 16.2401, lng: 80.6452 },
  contact: { phone: '+91 98765 43210' },
  openingHours: [{ day: 1, open: '06:30', close: '11:00' }],
  photos: [photo()],
  submit: true,
  ...overrides,
});

async function submitAs(role = 'user', overrides = {}) {
  const session = await loginAs(app, role);
  const res = await session.agent.post('/api/v1/businesses/submissions').send(submission(overrides));
  if (res.status !== 201) throw new Error(`submission failed in test: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...session, res, id: res.body.data?.id, slug: res.body.data?.slug };
}

describe('user submission and ownership', () => {
  it('a signed-in user submits a listing; the server sets owner, status and audit fields', async () => {
    const { res, user } = await submitAs('user');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Lakshmi Tiffins',
      status: 'pending',
      canManage: true,
      kind: 'food', // derived from the main category
      category: { slug: 'food-dining' },
      subcategory: { slug: 'tiffin-centres' },
      rejectionReason: null,
    });
    const stored = await Business.findById(res.body.data.id).lean();
    expect(String(stored.ownerId)).toBe(String(user._id));
    expect(String(stored.createdBy)).toBe(String(user._id));
    expect(stored.submittedAt).toBeTruthy();
    expect(stored.isVerified).toBe(false);
    // role is NOT changed until approval
    expect((await User.findById(user._id).lean()).role).toBe('user');
  });

  it('saves a draft when submit is not set', async () => {
    const { res } = await submitAs('user', { submit: undefined });
    expect(res.body.data.status).toBe('draft');
    expect((await Business.findById(res.body.data.id).lean()).submittedAt).toBeUndefined();
  });

  it('rejects client-supplied owner, status, review or verification fields', async () => {
    const { agent } = await loginAs(app, 'user');
    for (const extra of [{ status: 'published' }, { ownerId: '64b000000000000000000000' }, { isVerified: true }, { reviewedBy: 'x' }, { role: 'admin' }]) {
      const res = await agent.post('/api/v1/businesses/submissions').send(submission(extra));
      expect(res.status).toBe(400);
    }
    expect(await Business.countDocuments()).toBe(0);
  });

  it('validates required fields, phone, photos and the category/subcategory pair', async () => {
    const { agent } = await loginAs(app, 'user');
    const noPhone = await agent.post('/api/v1/businesses/submissions').send(submission({ contact: {} }));
    expect(noPhone.status).toBe(400);
    const badPhone = await agent.post('/api/v1/businesses/submissions').send(submission({ contact: { phone: 'call me' } }));
    expect(badPhone.status).toBe(400);
    const mismatch = await agent
      .post('/api/v1/businesses/submissions')
      .send(submission({ categoryId: String(shopping._id), subcategoryId: String(tiffin._id) }));
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.details.map((d) => d.field)).toContain('body.subcategoryId');
    const mainAsSub = await agent
      .post('/api/v1/businesses/submissions')
      .send(submission({ categoryId: String(food._id), subcategoryId: String(food._id) }));
    expect(mainAsSub.status).toBe(400);
    const foreignPhoto = await agent
      .post('/api/v1/businesses/submissions')
      .send(submission({ photos: [{ url: 'https://evil.example/a.jpg', publicId: 'mana-tenali/businesses/a' }] }));
    expect(foreignPhoto.status).toBe(400);
    const badId = await agent.post('/api/v1/businesses/submissions').send(submission({ categoryId: 'nope' }));
    expect(badId.status).toBe(400);
    expect(await Business.countDocuments()).toBe(0);
  });

  it('requires sign-in', async () => {
    const res = await request(app).post('/api/v1/businesses/submissions').set('Origin', TEST_ORIGIN).send(submission());
    expect(res.status).toBe(401);
  });

  it('prevents duplicate listings (same name in the same area) and limits pending submissions', async () => {
    const first = await submitAs('user');
    const dup = await first.agent
      .post('/api/v1/businesses/submissions')
      .send(submission({ name: '  lakshmi   TIFFINS! ' }));
    expect(dup.status).toBe(409);
    const otherArea = await first.agent
      .post('/api/v1/businesses/submissions')
      .send(submission({ address: { line: 'Main St', area: 'Kothapeta' } }));
    expect(otherArea.status).toBe(201);

    for (let i = 2; i < SUBMISSION_LIMITS.maxPending; i += 1) {
      const ok = await first.agent.post('/api/v1/businesses/submissions').send(submission({ name: `Shop ${i}` }));
      expect(ok.status).toBe(201);
    }
    const over = await first.agent.post('/api/v1/businesses/submissions').send(submission({ name: 'One Too Many' }));
    expect(over.status).toBe(409);
  });

  it('My Businesses lists only the caller’s own submissions with status and reason', async () => {
    const a = await submitAs('user');
    const b = await submitAs('user', { name: 'Other Person Shop', address: { line: 'Market Street', area: 'Ithanagar' } });
    const mine = await a.agent.get('/api/v1/businesses/mine');
    expect(mine.body.data.map((x) => x.name)).toEqual(['Lakshmi Tiffins']);
    expect(mine.body.data[0]).toMatchObject({ status: 'pending', submittedAt: expect.any(String) });

    const own = await a.agent.get(`/api/v1/businesses/mine/${a.id}`);
    expect(own.status).toBe(200);
    const notOwn = await a.agent.get(`/api/v1/businesses/mine/${b.id}`);
    expect(notOwn.status).toBe(404);
  });
});

describe('admin review', () => {
  it('only admins can list, approve or reject submissions', async () => {
    const { id } = await submitAs('user');
    for (const role of ['user', 'owner']) {
      const { agent } = await loginAs(app, role);
      expect((await agent.get('/api/v1/admin/submissions')).status).toBe(403);
      expect((await agent.post(`/api/v1/admin/submissions/${id}/approve`)).status).toBe(403);
      expect((await agent.post(`/api/v1/admin/submissions/${id}/reject`).send({ reason: 'Not real' })).status).toBe(403);
    }
    const anon = await request(app).post(`/api/v1/admin/submissions/${id}/approve`).set('Origin', TEST_ORIGIN);
    expect(anon.status).toBe(401);
    // the submitter can't approve their own listing either
    expect((await Business.findById(id).lean()).status).toBe('pending');
  });

  it('admin approves: listing goes live, reviewer recorded, submitter becomes owner', async () => {
    const { id, user, slug } = await submitAs('user');
    const admin = await loginAs(app, 'admin');
    const queue = await admin.agent.get('/api/v1/admin/submissions');
    expect(queue.body.data.map((x) => x.id)).toEqual([id]);
    expect(queue.body.data[0].owner).toMatchObject({ id: String(user._id) });

    const res = await admin.agent.post(`/api/v1/admin/submissions/${id}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'published', reviewedBy: { id: String(admin.user._id) } });
    expect(res.body.data.reviewedAt).toBeTruthy();
    expect((await User.findById(user._id).lean()).role).toBe('owner');
    expect((await request(app).get(`/api/v1/businesses/${slug}`)).status).toBe(200);

    // can't approve twice
    expect((await admin.agent.post(`/api/v1/admin/submissions/${id}/approve`)).status).toBe(409);
    const approved = await admin.agent.get('/api/v1/admin/submissions').query({ status: 'published' });
    expect(approved.body.data.map((x) => x.id)).toEqual([id]);
  });

  it('rejection requires a reason, which only the owner and admins can read', async () => {
    const { id, agent: ownerAgent, slug } = await submitAs('user');
    const admin = await loginAs(app, 'admin');
    expect((await admin.agent.post(`/api/v1/admin/submissions/${id}/reject`).send({})).status).toBe(400);
    expect((await admin.agent.post(`/api/v1/admin/submissions/${id}/reject`).send({ reason: 'no' })).status).toBe(400);

    const res = await admin.agent
      .post(`/api/v1/admin/submissions/${id}/reject`)
      .send({ reason: 'Please add a clear shop front photo.' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Please add a clear shop front photo.' });

    const mine = await ownerAgent.get(`/api/v1/businesses/mine/${id}`);
    expect(mine.body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Please add a clear shop front photo.' });

    // public never sees it, and the reason never leaks through public endpoints
    expect((await request(app).get(`/api/v1/businesses/${slug}`)).status).toBe(404);
    const ownerDetail = await ownerAgent.get(`/api/v1/businesses/${slug}`);
    expect(ownerDetail.body.data.rejectionReason).toBeUndefined();
    const list = await request(app).get('/api/v1/businesses');
    expect(JSON.stringify(list.body)).not.toContain('shop front photo');
  });

  it('only pending submissions can be reviewed; verification needs an approved listing', async () => {
    const { agent } = await loginAs(app, 'admin');
    const draft = await createBusiness({ status: 'draft', submittedAt: new Date() });
    expect((await agent.post(`/api/v1/admin/submissions/${draft._id}/approve`)).status).toBe(409);
    expect((await agent.post(`/api/v1/admin/submissions/${draft._id}/reject`).send({ reason: 'Incomplete' })).status).toBe(409);
    expect((await agent.patch(`/api/v1/admin/businesses/${draft._id}/verify`).send({ isVerified: true })).status).toBe(409);
    expect((await agent.post('/api/v1/admin/submissions/64b000000000000000000000/approve')).status).toBe(404);
  });
});

describe('public visibility', () => {
  it('pending and rejected listings never appear in public lists, category filters or detail', async () => {
    const pending = await submitAs('user');
    const rejected = await submitAs('user', { name: 'Rejected Place', address: { line: 'Market Street', area: 'Ithanagar' } });
    const admin = await loginAs(app, 'admin');
    const rej = await admin.agent.post(`/api/v1/admin/submissions/${rejected.id}/reject`).send({ reason: 'Duplicate of another listing' });
    expect(rej.status).toBe(200);

    for (const query of [{}, { categoryId: String(food._id) }, { subcategoryId: String(tiffin._id) }, { area: 'Bose Road' }, { lat: 16.2401, lng: 80.6452 }]) {
      const res = await request(app).get('/api/v1/businesses').query(query);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    }
    expect((await request(app).get(`/api/v1/businesses/${pending.slug}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/businesses/${rejected.slug}`)).status).toBe(404);
    // another signed-in user can't see them either
    const other = await loginAs(app, 'user');
    expect((await other.agent.get(`/api/v1/businesses/${pending.slug}`)).status).toBe(404);

    // after approval: visible in list, main-category and subcategory filters
    await admin.agent.post(`/api/v1/admin/submissions/${pending.id}/approve`);
    for (const query of [{}, { categoryId: String(food._id) }, { subcategoryId: String(tiffin._id) }]) {
      const res = await request(app).get('/api/v1/businesses').query(query);
      expect(res.body.data.map((b) => b.name)).toEqual(['Lakshmi Tiffins']);
      expect(res.body.data[0].subcategory).toMatchObject({ slug: 'tiffin-centres' });
    }
  });

  it('offers/reviews guards: content of non-approved businesses stays private', async () => {
    const statuses = ['draft', 'pending', 'rejected', 'hidden', 'archived'];
    const hiddenOnes = [];
    for (const status of statuses) hiddenOnes.push(await createBusiness({ status }));
    const live = await createBusiness({ status: 'published' });
    for (const b of hiddenOnes) await expect(assertPublished(b._id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(assertPublished(live._id)).resolves.toBeTruthy();
    const visible = await getPublishedIds([...hiddenOnes.map((b) => b._id), live._id]);
    expect([...visible]).toEqual([String(live._id)]);
  });
});

describe('owner editing', () => {
  it('owner edits everything while rejected, then resubmits; the old reason is cleared', async () => {
    const { id, agent } = await submitAs('user');
    const admin = await loginAs(app, 'admin');
    await admin.agent.post(`/api/v1/admin/submissions/${id}/reject`).send({ reason: 'Wrong address' });

    const edit = await agent.patch(`/api/v1/businesses/${id}`).send({
      name: 'Lakshmi Tiffin Centre',
      address: { line: 'Opp. Bus Stand', area: 'Bose Road' },
    });
    expect(edit.status).toBe(200);
    expect(edit.body.data).toMatchObject({ name: 'Lakshmi Tiffin Centre', status: 'rejected' });

    const resubmit = await agent.post(`/api/v1/businesses/${id}/submit`);
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.data).toMatchObject({ status: 'pending', rejectionReason: null });
    expect((await Business.findById(id).lean()).rejectionReason).toBeUndefined();
    // can't resubmit while pending
    expect((await agent.post(`/api/v1/businesses/${id}/submit`)).status).toBe(409);
  });

  it('after approval, material fields are admin-only; details, hours and photos stay editable', async () => {
    const { id, agent } = await submitAs('user');
    const admin = await loginAs(app, 'admin');
    await admin.agent.post(`/api/v1/admin/submissions/${id}/approve`);

    for (const change of [
      { name: 'New Name' },
      { address: { line: 'Elsewhere', area: 'Kothapeta' } },
      { location: { lat: 16.25, lng: 80.65 } },
      { categoryId: String(shopping._id) },
      { subcategoryId: String(tiffin._id) },
    ]) {
      const res = await agent.patch(`/api/v1/businesses/${id}`).send(change);
      expect(res.status).toBe(403);
    }
    const ok = await agent.patch(`/api/v1/businesses/${id}`).send({
      description: 'Now serving lunch too',
      openingHours: [{ day: 1, open: '06:30', close: '15:00' }],
      photos: [photo('a'), photo('b')],
      contact: { phone: '+91 98765 43210', whatsapp: '9876543210' },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('published'); // stays live; minor edits don't need review
    const noPhone = await agent.patch(`/api/v1/businesses/${id}`).send({ contact: { whatsapp: '9876543210' } });
    expect(noPhone.status).toBe(400);
  });

  it('users cannot edit, submit or read another owner’s business by guessing its ID', async () => {
    const victim = await submitAs('user');
    const attacker = await loginAs(app, 'user');
    expect((await attacker.agent.patch(`/api/v1/businesses/${victim.id}`).send({ description: 'pwned' })).status).toBe(404);
    expect((await attacker.agent.post(`/api/v1/businesses/${victim.id}/submit`)).status).toBe(404);
    expect((await attacker.agent.get(`/api/v1/businesses/mine/${victim.id}`)).status).toBe(404);
    expect((await attacker.agent.patch(`/api/v1/businesses/${victim.id}`).send({ status: 'published' })).status).toBe(400);
    const stored = await Business.findById(victim.id).lean();
    expect(stored.description).toBe('Idli, dosa and pesarattu');
    expect(stored.status).toBe('pending');
  });
});

describe('category migration', () => {
  it('moves old flat category references to main + subcategory and backfills name keys (dry run first)', async () => {
    const legacy = await Business.collection.insertOne({
      name: 'Old Listing',
      slug: 'old-listing',
      categoryId: tiffin._id, // a (now) subcategory stored as the category
      kind: 'food',
      address: { line: 'x', area: 'Main Road' },
      location: { type: 'Point', coordinates: [80.64, 16.23] },
      status: 'published',
    });
    const dry = await migrateCategoryReferences({ dryRun: true });
    expect(dry).toMatchObject({ remapped: 1, keyed: 1, dryRun: true });
    expect((await Business.findById(legacy.insertedId).lean()).subcategoryId).toBeUndefined();

    await migrateCategoryReferences({ dryRun: false });
    const after = await Business.findById(legacy.insertedId).lean();
    expect(String(after.categoryId)).toBe(String(food._id));
    expect(String(after.subcategoryId)).toBe(String(tiffin._id));
    expect(after.nameKey).toBe('oldlisting');
    expect((await migrateCategoryReferences({ dryRun: false })).examined).toBe(0);
  });
});
