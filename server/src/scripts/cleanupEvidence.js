/**
 * `npm run cleanup:evidence` - evidence retention (manual).
 *
 * Private event evidence is kept for 180 days after the final decision
 * (approved, rejected, withdrawn or removed), then deleted from Cloudinary.
 * Pending and changes-requested submissions are never touched.
 *
 * Dry run by default (reports counts only). Add --apply to delete:
 *   npm run cleanup:evidence -- --apply
 * Prints counts only - never file names, ids, URLs or credentials.
 */
import mongoose from 'mongoose';
import { loadEnv } from '../config/env.js';
import { redactUri } from '../config/db.js';
import { purgeExpiredEvidence, EVIDENCE_RETENTION_DAYS } from '../modules/events/events.service.js';

const out = (msg) => process.stdout.write(`${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`cleanup:evidence - ${msg}\n`);
  process.exit(1);
};

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    fail(err.message);
  }
  const apply = process.argv.includes('--apply');
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  } catch (err) {
    fail(`database connection failed (${redactUri(err?.message)})`);
  }
  const result = await purgeExpiredEvidence({ apply });
  out(`retention: ${EVIDENCE_RETENTION_DAYS} days after the final decision (before ${result.cutoff.toISOString().slice(0, 10)})`);
  if (apply) out(`deleted ${result.files} evidence file(s) from ${result.events} event(s)`);
  else out(`dry run: ${result.events} event(s) have evidence due for deletion. Re-run with --apply to delete.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  await mongoose.disconnect().catch(() => {});
  fail(redactUri(err?.message ?? 'failed'));
});
