/**
 * Launch readiness check: `npm run check:launch` (read-only).
 *
 * Connects to the database in server/.env and reports: reference categories,
 * an active admin, no sample data, indexes, and which optional services are
 * off. Prints names and counts only - never configuration values. Exits with
 * code 1 when something blocks launch. It never writes to the database.
 */
import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';
import { redactUri } from '../config/db.js';
import { launchReport } from './launch/launchCheck.js';

const out = (msg) => process.stdout.write(`${msg}\n`);

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    process.stderr.write(`check:launch - ${err.message}\n`);
    process.exit(1);
  }
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000, autoIndex: false });
  } catch (err) {
    process.stderr.write(`check:launch - database connection failed (${redactUri(err?.message)})\n`);
    process.exit(1);
  }
  const { checks, ok } = await launchReport(env);
  out(`Launch check (${env.NODE_ENV})`);
  for (const c of checks) out(`  [${c.ok ? 'ok  ' : c.level === 'error' ? 'FAIL' : 'warn'}] ${c.name}: ${c.detail}`);
  out(ok ? 'Ready: no blocking problems.' : 'Not ready: fix the FAIL items above (see LAUNCH.md).');
  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  process.stderr.write(`check:launch failed: ${redactUri(err?.message)}\n`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
