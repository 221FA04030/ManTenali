/**
 * `npm run check:media` - verify the image-upload (Cloudinary) configuration.
 *
 * 1. Reports which CLOUDINARY_* variables are missing from server/.env (names only).
 * 2. When all are set, calls Cloudinary's authenticated ping endpoint to prove
 *    the cloud name, API key and secret work together.
 * Never prints values, signatures or response bodies.
 */
import { loadEnv } from '../config/env.js';
import { missingCloudinaryVars, pingCloudinary } from '../common/integrations/cloudinary.js';

const out = (msg) => process.stdout.write(`${msg}\n`);

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    out(err.message);
    process.exit(1);
  }

  const missing = missingCloudinaryVars(env);
  if (missing.length) {
    out('Image uploads: NOT configured.');
    out(`Missing in server/.env: ${missing.join(', ')}`);
    out('Add them (see server/.env.example), restart the server, and run this check again.');
    process.exit(1);
  }

  out('Image uploads: all CLOUDINARY_* variables are set. Checking credentials with Cloudinary...');
  const result = await pingCloudinary();
  if (result.ok) {
    out('Cloudinary credentials OK. POST /api/v1/media/sign will work after a server restart.');
    return;
  }
  if (result.status === 401 || result.status === 403) {
    out(`Cloudinary rejected the credentials (HTTP ${result.status}). Check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.`);
  } else if (result.status === 404) {
    out('Cloudinary did not recognise the cloud (HTTP 404). Check CLOUDINARY_CLOUD_NAME.');
  } else {
    out(`Could not verify with Cloudinary (${result.status}). Check your internet connection and try again.`);
  }
  process.exit(1);
}

main();
