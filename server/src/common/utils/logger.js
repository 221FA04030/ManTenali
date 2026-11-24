import pino from 'pino';

/** Structured JSON logger. Secrets and credentials are redacted. */
export function createLogger({ level, pretty = false } = {}) {
  return pino({
    level: level ?? 'info',
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.idToken',
        '*.MONGODB_URI',
      ],
      censor: '[redacted]',
    },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}
