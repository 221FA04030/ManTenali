/**
 * Development/demo seed: `npm run seed`
 *
 * Always seeds reference categories (safe and idempotent).
 * With --samples it also adds SAMPLE content (businesses, offers, events, news), always flagged
 * isSeed = true, never verified, and shown as "Sample data" in the app:
 *   npm run seed -- --samples
 * Refuses NODE_ENV=production unless --confirm-production is passed, and then
 * seeds reference categories ONLY: sample content is never allowed in
 * production (there is no override).
 */
import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';
import { redactUri } from '../config/db.js';
import { seedCategories, seedCategoryTree, findIdBySlug, getParentMap } from '../modules/categories/categories.service.js';
import { seedBusinesses, getIdsBySlugs } from '../modules/businesses/businesses.service.js';
import { seedOffers } from '../modules/offers/offers.service.js';
import { seedEvents } from '../modules/events/events.service.js';
import { seedNews } from '../modules/news/news.service.js';
import { CATEGORY_SEED, BUSINESS_CATEGORY_TREE } from './seedData/categories.js';
import { BUSINESS_SEED } from './seedData/businesses.js';
import { OFFER_SEED } from './seedData/offers.js';
import { EVENT_SEED } from './seedData/events.js';
import { NEWS_SEED } from './seedData/news.js';

const out = (msg) => process.stdout.write(`${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`seed - ${msg}\n`);
  process.exit(1);
};

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    fail(err.message);
  }
  if (env.isProduction && process.argv.includes('--samples')) {
    fail('Sample data is for local development and testing only and is never seeded into production.');
  }
  if (env.isProduction && !process.argv.includes('--confirm-production')) {
    fail('NODE_ENV=production. Re-run with --confirm-production only if you really intend to seed production.');
  }
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  } catch (err) {
    fail(`database connection failed (${redactUri(err?.message)})`);
  }
  out('database connected');

  const tree = await seedCategoryTree(BUSINESS_CATEGORY_TREE);
  out(
    `business categories: ${tree.createdMain} main + ${tree.createdSub} subcategories created, ${tree.attached} existing attached to a main category`,
  );
  const categories = await seedCategories(CATEGORY_SEED);
  out(`event/news categories: ${categories.created} created, ${categories.existing} already present`);

  if (process.argv.includes('--samples')) {
    const slugs = [...new Set(BUSINESS_SEED.map((b) => b.categorySlug))];
    const ids = new Map();
    for (const slug of slugs) {
      const id = await findIdBySlug('business', slug);
      if (!id) continue;
      const parentId = (await getParentMap([id])).get(String(id));
      ids.set(slug, { id, parentId });
    }
    const businesses = await seedBusinesses(BUSINESS_SEED, ids);
    const offers = await seedOffers(OFFER_SEED, await getIdsBySlugs(OFFER_SEED.map((o) => o.businessSlug)));
    out(`sample businesses: ${businesses.created} created, ${businesses.skipped} skipped (already present)`);
    out(`sample offers: ${offers.created} created, ${offers.skipped} skipped (already present)`);
    const eventCats = new Map();
    for (const slug of new Set(EVENT_SEED.map((e) => e.categorySlug))) eventCats.set(slug, await findIdBySlug('event', slug));
    const events = await seedEvents(EVENT_SEED, eventCats);
    out(`sample events: ${events.created} created, ${events.skipped} skipped (already present)`);
    const newsCats = new Map();
    for (const slug of new Set(NEWS_SEED.map((n) => n.categorySlug).filter(Boolean))) newsCats.set(slug, await findIdBySlug('news', slug));
    const news = await seedNews(NEWS_SEED, newsCats);
    out(`sample news: ${news.created} created, ${news.skipped} skipped (already present)`);
  } else {
    out('sample content skipped (run `npm run seed -- --samples` to add demo listings labelled "Sample data")');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`seed failed: ${redactUri(err?.message)}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
