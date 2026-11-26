import { loadEnv, EnvValidationError } from './config/env.js';
import { connectDb, disconnectDb, redactUri } from './config/db.js';
import { createLogger } from './common/utils/logger.js';
import { createApp } from './app.js';
import { missingCloudinaryVars } from './common/integrations/cloudinary.js';
import { initErrorReporting } from './common/integrations/sentry.js';

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      // Only variable names are printed, never values.
      process.stderr.write(`${err.message}\nCopy server/.env.example to server/.env and fill it in.\n`);
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger({
    level: env.LOG_LEVEL ?? (env.isProduction ? 'info' : 'debug'),
    pretty: !env.isProduction,
  });

  await initErrorReporting(env, logger);

  // Make a missing image-upload configuration obvious at startup (names only, never values).
  const missingMedia = missingCloudinaryVars(env);
  if (missingMedia.length) {
    logger.warn(
      { missing: missingMedia },
      'image uploads disabled: set these in server/.env and restart (POST /media/sign returns 503 until then)',
    );
  }

  try {
    await connectDb(env.MONGODB_URI, logger);
  } catch (err) {
    logger.fatal({ errName: err?.name, reason: redactUri(err?.message) }, 'database connection failed');
    process.exit(1);
  }

  const app = createApp({ env, logger });
  const server = app.listen(env.PORT, () => logger.info(`API listening on port ${env.PORT}`));

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
