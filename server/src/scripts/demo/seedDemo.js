/**
 * Demo data loader (local development and testing ONLY).
 *
 * Safety:
 *   - refuses when NODE_ENV (process or loaded config) is production - a hard error, not a warning;
 *   - refuses unless the connected database is a LOCAL, disposable MongoDB
 *     (mongodb://127.0.0.1 | localhost | ::1 - e.g. the in-memory server used by `npm run demo`),
 *     so it can never write to MongoDB Atlas or any remote database;
 *   - idempotent: every record is matched by a stable key (email, slug, title,
 *     storage id) and skipped if present, so re-running never duplicates anything;
 *   - never deletes or overwrites existing records.
 */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { getEnv } from '../../config/env.js';
import { User } from '../../modules/users/users.model.js';
import { hashPassword } from '../../modules/users/users.service.js';
import { Business, normaliseName } from '../../modules/businesses/businesses.model.js';
import { seedBusinesses, getIdsBySlugs } from '../../modules/businesses/businesses.service.js';
import { Offer } from '../../modules/offers/offers.model.js';
import { seedOffers } from '../../modules/offers/offers.service.js';
import { Event } from '../../modules/events/events.model.js';
import { EventEvidence } from '../../modules/events/evidence.model.js';
import { seedEvents } from '../../modules/events/events.service.js';
import { seedCategories, seedCategoryTree, findIdBySlug, getParentMap } from '../../modules/categories/categories.service.js';
import { evidenceFolderFor } from '../../modules/media/media.service.js';
import { toPoint } from '../../common/utils/geo.js';
import { istDateTime, istStartOfDay, istEndOfDay, toIstDate, toIstDateTime } from '../../common/utils/dates.js';
import { CATEGORY_SEED, BUSINESS_CATEGORY_TREE } from '../seedData/categories.js';
import { BUSINESS_SEED } from '../seedData/businesses.js';
import { OFFER_SEED } from '../seedData/offers.js';
import { EVENT_SEED } from '../seedData/events.js';
import { DEMO_USERS, DEMO_BUSINESSES, DEMO_OFFERS, DEMO_EVENTS, DEMO_SUBMISSIONS, EVIDENCE_FIXTURES } from './demoData.js';

const DAY = 86_400_000;
export const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

/** True only for a plain local MongoDB (never mongodb+srv / Atlas / remote hosts). */
export function isLocalMongoUri(uri) {
  const m = /^mongodb:\/\/(?:[^@/]*@)?(\[::1\]|127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$|\?)/i.exec(String(uri ?? ''));
  return Boolean(m);
}

/** The host the app is actually connected to (Atlas resolves to remote hosts, never local). */
function connectedUri() {
  const c = mongoose.connection;
  return c?.readyState === 1 && c.host ? `mongodb://${c.host.includes(':') ? `[${c.host}]` : c.host}:${c.port}/` : '';
}

/** Throws unless this is a non-production run against a local disposable database. */
export function assertDemoTarget({ uri = connectedUri(), env = getEnv(), nodeEnv = process.env.NODE_ENV } = {}) {
  if (nodeEnv === 'production' || env.isProduction) {
    throw new Error('Demo data is for local development and testing only and is never loaded in production.');
  }
  if (!isLocalMongoUri(uri)) {
    throw new Error('Demo data only goes into a local, disposable MongoDB (mongodb://127.0.0.1 or localhost). Refusing to write to this database.');
  }
}

const dayAt = (now, days) => toIstDateTime(new Date(now.getTime() + days * DAY)).slice(0, 10);
const oid = (id) => new mongoose.Types.ObjectId(id);

function eventTimes(item, now) {
  const day = dayAt(now, item.startsInDays);
  if (item.allDay) {
    const last = dayAt(now, item.startsInDays + (item.days ?? 1) - 1);
    return { startAt: istStartOfDay(day), endAt: istEndOfDay(last), allDay: true };
  }
  const startAt = istDateTime(`${day}T${String(item.startHourIst).padStart(2, '0')}:00`);
  return { startAt, endAt: new Date(startAt.getTime() + item.hours * 3_600_000), allDay: false };
}

async function seedUsers() {
  const ids = new Map();
  let created = 0;
  for (const u of DEMO_USERS) {
    ids.set(u.key, oid(u._id));
    if (await User.exists({ $or: [{ _id: oid(u._id) }, { email: u.email }] })) continue;
    await User.create({
      _id: oid(u._id),
      name: u.name,
      email: u.email,
      passwordHash: await hashPassword(u.password),
      role: u.role,
      language: u.language,
      preferredArea: u.preferredArea,
      status: u.status ?? 'active',
    });
    created += 1;
  }
  return { ids, created };
}

async function categoryRef(slug) {
  const id = await findIdBySlug('business', slug);
  if (!id) throw new Error(`Demo data needs business category "${slug}"`);
  const parent = (await getParentMap([id])).get(String(id));
  return parent ? { categoryId: oid(parent), subcategoryId: id } : { categoryId: id };
}

async function seedDemoBusinesses(users, now) {
  let created = 0;
  const admin = users.get('admin');
  for (const b of DEMO_BUSINESSES) {
    if (await Business.exists({ slug: b.slug })) continue;
    const { owner, categorySlug, lat, lng, submittedDaysAgo, rejectionReason, status, ...rest } = b;
    const ownerId = users.get(owner);
    const submittedAt = submittedDaysAgo !== undefined ? new Date(now.getTime() - submittedDaysAgo * DAY) : undefined;
    await Business.create({
      ...rest,
      ...(await categoryRef(categorySlug)),
      nameKey: normaliseName(b.name),
      location: toPoint(lat, lng),
      ownerId,
      createdBy: ownerId,
      status,
      isSeed: true,
      isVerified: false,
      submittedAt,
      ...(status === 'rejected' ? { rejectionReason, reviewedBy: admin, reviewedAt: new Date(now.getTime() - DAY) } : {}),
    });
    created += 1;
  }
  return created;
}

async function seedDemoOffers(users, now) {
  const businessIds = await getIdsBySlugs(DEMO_OFFERS.map((o) => o.business));
  let created = 0;
  for (const o of DEMO_OFFERS) {
    const businessId = businessIds.get(o.business);
    if (!businessId || (await Offer.exists({ businessId, title: o.title }))) continue;
    const { business: _b, startsInDays, endsInDays, ...rest } = o;
    await Offer.create({
      ...rest,
      businessId,
      validFrom: istStartOfDay(toIstDate(new Date(now.getTime() + startsInDays * DAY))),
      validTo: istEndOfDay(toIstDate(new Date(now.getTime() + endsInDays * DAY))),
      isSeed: true,
      createdBy: users.get(o.business.startsWith('demo-suresh') ? 'owner2' : 'owner'),
    });
    created += 1;
  }
  return created;
}

const logEntry = (action, actorId, actorRole, at, fromStatus, toStatus, note) => ({ action, actorId, actorRole, at, fromStatus, toStatus, note });

async function seedDemoEvents(users, now) {
  const admin = users.get('admin');
  const businessIds = await getIdsBySlugs(DEMO_EVENTS.map((e) => e.business).filter(Boolean));
  let created = 0;
  for (const e of DEMO_EVENTS) {
    if (await Event.exists({ slug: e.slug })) continue;
    const categoryId = await findIdBySlug('event', e.categorySlug);
    if (!categoryId) throw new Error(`Demo data needs event category "${e.categorySlug}"`);
    const { categorySlug: _c, startsInDays: _s, startHourIst: _h, hours: _d, days: _n, allDay: _a, lat, lng, business, status, cancelReason, ...rest } = e;
    const at = new Date(now.getTime() - 2 * DAY);
    const log = [logEntry('created', admin, 'admin', at, undefined, status === 'draft' ? 'draft' : 'published')];
    if (status === 'cancelled' || status === 'hidden') log.push(logEntry(status, admin, 'admin', now, 'published', status, cancelReason));
    await Event.create({
      ...rest,
      ...eventTimes(e, now),
      categoryId,
      location: lat !== undefined ? toPoint(lat, lng) : undefined,
      businessId: business ? businessIds.get(business) : undefined,
      status,
      source: 'admin',
      isSeed: true,
      createdBy: admin,
      publishedAt: status === 'draft' ? undefined : at,
      publishedBy: status === 'draft' ? undefined : admin,
      ...(status === 'cancelled' ? { cancelledAt: now, cancelReason } : {}),
      moderationLog: log,
    });
    created += 1;
  }
  return created;
}

/** Private evidence storage id for a demo submission (stable, inside the submitter's own folder). */
export const demoEvidencePublicId = (userId, slug, fixtureKey) => `${evidenceFolderFor(userId)}/demo-${slug.replace(/^demo-sub-/, '')}-${fixtureKey}`;

async function seedDemoSubmissions(users, now) {
  const admin = users.get('admin');
  let events = 0;
  let evidence = 0;
  for (const s of DEMO_SUBMISSIONS) {
    const submitter = users.get(s.submitter);
    let doc = await Event.findOne({ slug: s.slug });
    if (!doc) {
      const categoryId = await findIdBySlug('event', s.categorySlug);
      if (!categoryId) throw new Error(`Demo data needs event category "${s.categorySlug}"`);
      const submittedAt = new Date(now.getTime() - s.submittedDaysAgo * DAY);
      const reviewedAt = new Date(submittedAt.getTime() + 6 * 3_600_000);
      const log = [logEntry('submitted', submitter, 'user', submittedAt, undefined, 'pending_review')];
      let review;
      const extra = {};
      if (s.status === 'changes_requested' || s.status === 'rejected') {
        review = { outcome: s.status, note: s.reviewNote, reviewedBy: admin, reviewedAt };
        log.push(logEntry(s.status, admin, 'admin', reviewedAt, 'pending_review', s.status, s.reviewNote));
      } else if (s.status === 'published') {
        review = { outcome: 'approved', reviewedBy: admin, reviewedAt };
        log.push(logEntry('approved', admin, 'admin', reviewedAt, 'pending_review', 'published'));
        Object.assign(extra, { publishedAt: reviewedAt, publishedBy: admin });
      } else if (s.status === 'withdrawn') {
        log.push(logEntry('withdrawn', submitter, 'user', reviewedAt, 'pending_review', 'withdrawn'));
      }
      const { categorySlug: _c, startsInDays: _s, startHourIst: _h, hours: _d, lat, lng, submitter: _u, status, submittedDaysAgo: _a, reviewNote: _r, evidence: _e, ...rest } = s;
      doc = await Event.create({
        ...rest,
        ...eventTimes(s, now),
        categoryId,
        location: lat !== undefined ? toPoint(lat, lng) : undefined,
        status,
        source: 'community',
        isSeed: true,
        createdBy: submitter,
        submittedBy: submitter,
        submittedAt,
        lastSubmittedAt: submittedAt,
        revision: 1,
        review,
        moderationLog: log,
        ...extra,
      });
      events += 1;
    }
    for (const item of s.evidence) {
      const fx = EVIDENCE_FIXTURES[item.fixture];
      const publicId = demoEvidencePublicId(submitter, s.slug, item.fixture);
      if (await EventEvidence.exists({ 'storage.publicId': publicId })) continue;
      await EventEvidence.create({
        eventId: doc._id,
        uploadedBy: submitter,
        kind: fx.kind,
        note: item.note,
        originalFilename: fx.file,
        storage: {
          publicId,
          resourceType: 'image',
          deliveryType: 'private',
          format: fx.format,
          bytes: statSync(`${FIXTURES_DIR}${fx.file}`).size,
          width: fx.width,
          height: fx.height,
          pages: fx.pages ?? undefined,
        },
      });
      evidence += 1;
    }
  }
  return { events, evidence };
}

/** Every private evidence fixture with its storage id and local file (for optional Cloudinary upload). */
export function listEvidenceFixtures() {
  const byKey = new Map(DEMO_USERS.map((u) => [u.key, u._id]));
  return DEMO_SUBMISSIONS.flatMap((s) =>
    s.evidence.map((item) => {
      const fx = EVIDENCE_FIXTURES[item.fixture];
      return { publicId: demoEvidencePublicId(byKey.get(s.submitter), s.slug, item.fixture), path: `${FIXTURES_DIR}${fx.file}`, format: fx.format };
    }),
  );
}

export const readFixture = (path) => readFileSync(path);

/**
 * Load everything: reference categories, the existing "(Sample)" content
 * (same as `npm run seed -- --samples`) and the demo accounts, businesses,
 * offers, events and private moderation fixtures.
 */
export async function seedDemo({ now = new Date() } = {}) {
  assertDemoTarget();
  await seedCategoryTree(BUSINESS_CATEGORY_TREE);
  await seedCategories(CATEGORY_SEED);

  // Existing sample content (unchanged behaviour of `npm run seed -- --samples`).
  const sampleIds = new Map();
  for (const slug of new Set(BUSINESS_SEED.map((b) => b.categorySlug))) {
    const id = await findIdBySlug('business', slug);
    if (id) sampleIds.set(slug, { id, parentId: (await getParentMap([id])).get(String(id)) });
  }
  const samples = await seedBusinesses(BUSINESS_SEED, sampleIds);
  const sampleOffers = await seedOffers(OFFER_SEED, await getIdsBySlugs(OFFER_SEED.map((o) => o.businessSlug)), now);
  const eventCats = new Map();
  for (const slug of new Set(EVENT_SEED.map((e) => e.categorySlug))) eventCats.set(slug, await findIdBySlug('event', slug));
  const sampleEvents = await seedEvents(EVENT_SEED, eventCats, now);

  const users = await seedUsers();
  const businesses = await seedDemoBusinesses(users.ids, now);
  const offers = await seedDemoOffers(users.ids, now);
  const events = await seedDemoEvents(users.ids, now);
  const submissions = await seedDemoSubmissions(users.ids, now);
  return {
    users: users.created,
    businesses: samples.created + businesses,
    offers: sampleOffers.created + offers,
    events: sampleEvents.created + events + submissions.events,
    evidence: submissions.evidence,
  };
}
