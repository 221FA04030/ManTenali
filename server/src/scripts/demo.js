/**
 * `npm run demo` - local demo stack with realistic sample data (DEVELOPMENT ONLY).
 *
 *   1. starts a throwaway in-memory MongoDB (mongodb-memory-server, a dev dependency),
 *   2. loads reference categories + all demo data (scripts/demo/seedDemo.js),
 *   3. starts the API on http://localhost:4055 and the web app on http://localhost:5174.
 * Everything disappears when you stop it (Ctrl+C). Run it again for a fresh copy.
 *
 * It never reads MONGODB_URI, JWT_SECRET or Google settings from server/.env,
 * so it cannot touch MongoDB Atlas. Refuses to run when NODE_ENV is production
 * (in the shell or in server/.env).
 *
 * Options:
 *   --cloudinary  also use the CLOUDINARY_* variables from server/.env, so uploads
 *                 work and the synthetic evidence fixtures are uploaded as PRIVATE
 *                 files (fixed names, overwritten on each run - no pile-up).
 *   --api-only    don't start the web app.
 * Ports: DEMO_API_PORT (default 4055), DEMO_WEB_PORT (default 5174).
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ENV_FILE = `${ROOT}server/.env`;
const args = new Set(process.argv.slice(2));
const out = (msg = '') => process.stdout.write(`${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`demo - ${msg}\n`);
  process.exit(1);
};

/** Read only the named keys from server/.env (values are never printed). */
function readEnvFile(keys) {
  if (!existsSync(ENV_FILE)) return {};
  const found = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && keys.includes(m[1])) found[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return found;
}

// Hard production guard - before anything starts.
if (process.env.NODE_ENV === 'production' || readEnvFile(['NODE_ENV']).NODE_ENV === 'production') {
  fail('NODE_ENV is production. The demo stack and its sample data are for local development only.');
}

let MongoMemoryServer;
try {
  ({ MongoMemoryServer } = await import('mongodb-memory-server'));
} catch {
  fail('mongodb-memory-server is not installed (it is a dev dependency). Run `npm install` first.');
}

const apiPort = Number(process.env.DEMO_API_PORT || 4055);
const webPort = Number(process.env.DEMO_WEB_PORT || 5174);
const mongod = await MongoMemoryServer.create();

// The demo's own configuration - never the real database or secrets.
const demoEnv = {
  NODE_ENV: 'development',
  PORT: String(apiPort),
  MONGODB_URI: mongod.getUri('mana_tenali_demo'),
  CLIENT_ORIGIN: `http://localhost:${webPort}`,
  JWT_SECRET: randomBytes(32).toString('hex'), // new every run
  LOG_LEVEL: process.env.LOG_LEVEL || 'warn',
};
for (const k of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'GOOGLE_CLIENT_ID', 'COOKIE_DOMAIN']) delete process.env[k];
if (args.has('--cloudinary')) Object.assign(demoEnv, readEnvFile(['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']));
Object.assign(process.env, demoEnv);

const mongoose = (await import('mongoose')).default;
const { loadEnv } = await import('../config/env.js');
const { createLogger } = await import('../common/utils/logger.js');
const { createApp } = await import('../app.js');
const { seedDemo, listEvidenceFixtures, readFixture } = await import('./demo/seedDemo.js');
const { getCloudinaryConfig, signParams, uploadUrl } = await import('../common/integrations/cloudinary.js');
const { DEMO_USERS } = await import('./demo/demoData.js');

let web;
let server;
const stop = async (code = 0) => {
  web?.kill();
  server?.close();
  await mongoose.disconnect().catch(() => {});
  await mongod.stop().catch(() => {});
  process.exit(code);
};
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

try {
  const env = loadEnv();
  await mongoose.connect(env.MONGODB_URI);
  const summary = await seedDemo();
  out(`demo data: ${summary.users} accounts, ${summary.businesses} businesses, ${summary.offers} offers, ${summary.events} events, ${summary.evidence} private evidence files`);

  const cloud = getCloudinaryConfig();
  if (args.has('--cloudinary')) {
    if (!cloud) {
      out('--cloudinary: CLOUDINARY_* variables are missing in server/.env - uploads stay disabled.');
    } else {
      let ok = 0;
      const fixtures = listEvidenceFixtures();
      for (const fx of fixtures) {
        const params = { timestamp: Math.floor(Date.now() / 1000), public_id: fx.publicId, type: 'private', overwrite: true, invalidate: true };
        const form = new FormData();
        form.append('file', new Blob([readFixture(fx.path)]), fx.path.split(/[\\/]/).pop());
        for (const [k, v] of Object.entries(params)) form.append(k, String(v));
        form.append('api_key', cloud.apiKey);
        form.append('signature', signParams(params, cloud.apiSecret));
        const res = await fetch(uploadUrl(cloud.cloudName), { method: 'POST', body: form }).catch(() => null);
        if (res?.ok) ok += 1;
      }
      out(`--cloudinary: ${ok}/${fixtures.length} synthetic evidence fixtures uploaded as private files.`);
    }
  }

  server = createApp({ env, logger: createLogger({ level: env.LOG_LEVEL ?? 'warn' }) }).listen(apiPort);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  if (!args.has('--api-only')) {
    web = spawn(process.execPath, [`${ROOT}node_modules/vite/bin/vite.js`, '--port', String(webPort), '--strictPort'], {
      cwd: `${ROOT}client`,
      env: { ...process.env, API_PROXY_TARGET: `http://localhost:${apiPort}` },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    web.on('exit', (code) => code && out(`web app exited (${code}) - is port ${webPort} free?`));
  }

  out('');
  out('Mana Tenali DEMO (local only, in-memory data - lost when you stop it)');
  out(`  Web app : http://localhost:${webPort}${args.has('--api-only') ? ' (not started: --api-only)' : ''}`);
  out(`  API     : http://localhost:${apiPort}/api/v1/health`);
  out('  Demo accounts (development only - never use in production):');
  for (const u of DEMO_USERS) out(`    ${u.role.padEnd(5)} ${u.email.padEnd(22)} ${u.password}${u.status === 'blocked' ? '  (blocked - login is refused)' : ''}`);
  out(`  File uploads: ${cloud ? 'enabled (your Cloudinary account)' : 'disabled (add --cloudinary to enable)'}`);
  out('Press Ctrl+C to stop.');
} catch (err) {
  process.stderr.write(`demo failed: ${err?.message}\n`);
  await stop(1);
}
