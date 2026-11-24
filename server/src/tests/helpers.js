import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { inject } from 'vitest';
import { loadEnv } from '../config/env.js';
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
