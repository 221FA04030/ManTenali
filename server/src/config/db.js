import mongoose from 'mongoose';

/** Hide any connection string that might appear inside a driver error message. */
export function redactUri(text) {
  return String(text ?? '').replace(/mongodb(\+srv)?:\/\/\S+/gi, '[redacted-uri]');
}

export async function connectDb(uri, logger) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true });
  // Never log the URI or host - only that the connection succeeded.
  logger.info('database connected');
  mongoose.connection.on('disconnected', () => logger.warn('database disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('database reconnected'));
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

/** 'up' when the default connection is ready, otherwise 'down'. */
export function dbStatus() {
  return mongoose.connection.readyState === 1 ? 'up' : 'down';
}

/** Round-trip ping used by the health endpoint. */
export async function pingDb() {
  if (dbStatus() !== 'up') return false;
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
