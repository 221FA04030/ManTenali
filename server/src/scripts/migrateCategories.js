/**
 * `npm run migrate:categories` - one-off upgrade to two-level business categories.
 *
 * Run `npm run seed` first (creates the main categories and attaches the
 * original flat categories to them). This script then:
 *  1. moves business references from a (now) subcategory in categoryId to
 *     subcategoryId and sets categoryId to its main category;
 *  2. backfills the duplicate-check name key;
 *  3. deactivates superseded subcategories ONLY if no business uses them.
 *
 * DRY RUN by default - it only reports. Add `-- --apply` to write changes.
 * Never deletes anything. Refuses production without --confirm-production.
 */
import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';
import { redactUri } from '../config/db.js';
import { migrateCategoryReferences, countBySubcategory } from '../modules/businesses/businesses.service.js';
import { findIdBySlug, setActive } from '../modules/categories/categories.service.js';
import { SUPERSEDED_SUBCATEGORIES } from './seedData/categories.js';

const out = (msg) => process.stdout.write(`${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`migrate:categories - ${msg}\n`);
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
    fail('NODE_ENV=production. Re-run with --confirm-production only after a backup.');
  }
  const apply = process.argv.includes('--apply');
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  } catch (err) {
    fail(`database connection failed (${redactUri(err?.message)})`);
  }
  out(`database connected - ${apply ? 'APPLYING changes' : 'dry run (no changes; add -- --apply to write)'}`);

  const refs = await migrateCategoryReferences({ dryRun: !apply });
  out(`businesses examined: ${refs.examined}; category references to move: ${refs.remapped}; name keys to backfill: ${refs.keyed}`);

  for (const slug of SUPERSEDED_SUBCATEGORIES) {
    const id = await findIdBySlug('business', slug);
    if (!id) continue;
    const used = await countBySubcategory(id);
    if (used > 0) {
      out(`keep "${slug}" active: used by ${used} business(es)`);
    } else {
      out(`${apply ? 'deactivated' : 'would deactivate'} unused superseded subcategory "${slug}"`);
      if (apply) await setActive(id, false);
    }
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`migrate:categories failed: ${redactUri(err?.message)}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
