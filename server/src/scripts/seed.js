/**
 * Development/demo seed: `npm run seed`
 *
 * Always seeds reference categories (safe and idempotent).
 * With --samples it also adds SAMPLE content (businesses...), always flagged
 * isSeed = true, never verified, and shown as "Sample data" in the app:
 *   npm run seed -- --samples
 * Refuses NODE_ENV=production unless --confirm-production is passed.
 */
import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';
import { redactUri } from '../config/db.js';
import { seedCategories, seedCategoryTree, findIdBySlug, getParentMap } from '../modules/categories/categories.service.js';
import { seedBusinesses } from '../modules/businesses/businesses.service.js';
import { CATEGORY_SEED, BUSINESS_CATEGORY_TREE } from './seedData/categories.js';
import { BUSINESS_SEED } from './seedData/businesses.js';

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
    out(`sample businesses: ${businesses.created} created, ${businesses.skipped} skipped (already present)`);
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
