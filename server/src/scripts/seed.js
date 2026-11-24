/**
 * Development/demo seed: `npm run seed`
 *
 * Step 2 seeds reference categories (safe and idempotent). Later steps add
 * sample content, always flagged isSeed = true and shown as "Sample data".
 * Refuses NODE_ENV=production unless --confirm-production is passed.
 */
import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';
import { redactUri } from '../config/db.js';
import { seedCategories } from '../modules/categories/categories.service.js';
import { CATEGORY_SEED } from './seedData/categories.js';

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

  const categories = await seedCategories(CATEGORY_SEED);
  out(`categories: ${categories.created} created, ${categories.existing} already present`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`seed failed: ${redactUri(err?.message)}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
