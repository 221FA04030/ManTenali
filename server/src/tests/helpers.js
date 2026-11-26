import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { inject, onTestFinished } from 'vitest';
import { loadEnv, resetEnvCache } from '../config/env.js';
import { createLogger } from '../common/utils/logger.js';
import { createApp } from '../app.js';

export const TEST_ORIGIN = 'http://localhost:5173';

export function buildTestApp(overrides = {}) {
  const env = loadEnv({ ...process.env, ...overrides });
  return createApp({ env, logger: createLogger({ level: 'silent' }) });
}

/** Connect mongoose to a fresh database on the shared in-memory server. */
export async function connectTestDb() {
  const uri = inject('mongoUri');
  await mongoose.connect(uri, { dbName: `t_${randomUUID().slice(0, 12)}` });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function clearTestDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}

/**
 * Switch the current test to a production-shaped configuration (Step 10 env
 * rules: https origins, no local database). The database address uses the
 * reserved .invalid domain, so nothing can ever connect to it. Restored
 * automatically when the test finishes.
 */
export function enterProductionEnv() {
  const keys = ['NODE_ENV', 'CLIENT_ORIGIN', 'MONGODB_URI'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    NODE_ENV: 'production',
    CLIENT_ORIGIN: 'https://app.example.invalid',
    MONGODB_URI: 'mongodb+srv://placeholder.example.invalid/never-used',
  });
  resetEnvCache();
  onTestFinished(() => {
    for (const k of keys) process.env[k] = saved[k];
    resetEnvCache();
  });
}
