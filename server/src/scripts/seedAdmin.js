/**
 * Initial admin bootstrap (spec section 6): `npm run seed:admin`
 *
 * Reads ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD from server/.env, hashes the
 * password and upserts ONE user with role admin. There is no HTTP route that
 * can do this. Refuses to run with NODE_ENV=production unless the operator
 * passes --confirm-production explicitly. The password is never printed.
 */
import mongoose from 'mongoose';
import { z } from 'zod';
import { loadEnv } from '../config/env.js';
import { redactUri } from '../config/db.js';
import { upsertAdmin } from '../modules/users/users.service.js';

const out = (msg) => process.stdout.write(`${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`seed:admin - ${msg}\n`);
  process.exit(1);
};

const seedSchema = z.object({
  ADMIN_SEED_EMAIL: z.email('ADMIN_SEED_EMAIL must be a valid email'),
  ADMIN_SEED_PASSWORD: z
    .string({ error: 'ADMIN_SEED_PASSWORD is required' })
    .min(12, 'ADMIN_SEED_PASSWORD must be at least 12 characters')
    .max(72, 'ADMIN_SEED_PASSWORD must be at most 72 characters'),
  ADMIN_SEED_NAME: z.string().trim().min(2).max(80).optional(),
});

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    fail(err.message);
  }
  if (env.isProduction && !process.argv.includes('--confirm-production')) {
    fail('NODE_ENV=production. Re-run with --confirm-production if you really intend to create an admin in production.');
  }

  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) fail(parsed.error.issues.map((i) => i.message).join('; '));
  const { ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, ADMIN_SEED_NAME } = parsed.data;

  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  } catch (err) {
    fail(`database connection failed (${redactUri(err?.message)})`);
  }
  out('database connected');
  const admin = await upsertAdmin({ email: ADMIN_SEED_EMAIL, password: ADMIN_SEED_PASSWORD, name: ADMIN_SEED_NAME });
  out(`admin account ready: ${admin.email} (role: ${admin.role})`);
  out('Tip: remove ADMIN_SEED_PASSWORD from server/.env now that the admin exists.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  process.stderr.write(`seed:admin failed: ${redactUri(err?.message)}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
