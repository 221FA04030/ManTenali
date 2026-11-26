import { describe, it, expect, afterEach } from 'vitest';
import { enterProductionEnv } from '../tests/helpers.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resetEnvCache } from '../config/env.js';
import { seedBusinesses } from '../modules/businesses/businesses.service.js';

const seedScript = fileURLToPath(new URL('./seed.js', import.meta.url));

function runSeed(args, extraEnv) {
  return spawnSync(process.execPath, [seedScript, ...args], {
    env: {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      NODE_ENV: 'production',
      // Placeholder values only - the script must refuse before connecting anywhere.
      MONGODB_URI: 'mongodb+srv://placeholder.example.invalid/never-used', // reserved domain: never resolves
      CLIENT_ORIGIN: 'https://example.invalid',
      JWT_SECRET: 'x'.repeat(40),
      ...extraEnv,
    },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('sample data never reaches production', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });

  it('the seed script refuses --samples in production, even with --confirm-production', () => {
    const res = runSeed(['--samples', '--confirm-production']);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/never seeded into production/);
    expect(res.stdout).not.toMatch(/database connected/);
  });

  it('seedBusinesses itself refuses to run in production', async () => {
    enterProductionEnv();
    await expect(seedBusinesses([], new Map())).rejects.toThrow(/cannot be seeded in production/);
  });
});

describe('root npm scripts forward their arguments (D10.15)', () => {
  it('every root script that runs a server script ends with "--", so `npm run seed -- --samples` passes --samples on', async () => {
    const { readFileSync } = await import('node:fs');
    const root = JSON.parse(readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'));
    for (const name of ['seed', 'seed:admin', 'check:media', 'migrate:categories', 'cleanup:evidence', 'check:launch']) {
      expect(`${name}: ${root.scripts[name]}`).toBe(`${name}: npm run ${name} -w server --`);
    }
  });
});
