import { describe, it, expect, afterEach } from 'vitest';
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
      MONGODB_URI: 'mongodb://127.0.0.1:1/never-used',
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
    process.env.NODE_ENV = 'production';
    resetEnvCache();
    await expect(seedBusinesses([], new Map())).rejects.toThrow(/cannot be seeded in production/);
  });
});
