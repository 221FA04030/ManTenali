import { z } from 'zod';

/**
 * Environment validation (fail fast).
 * Values are NEVER included in error messages - only variable names - so a
 * malformed secret (for example MONGODB_URI) can't leak into logs.
 */
const csv = (value) =>
  String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  MONGODB_URI: z
    .string({ error: 'is required' })
    .regex(/^mongodb(\+srv)?:\/\/\S+$/, 'must be a mongodb:// or mongodb+srv:// URI'),
  CLIENT_ORIGIN: z
    .string({ error: 'is required' })
    .min(1, 'is required')
    .refine(
      (v) => csv(v).every((o) => /^https?:\/\/[^/\s]+$/.test(o)),
      'must be a comma-separated list of origins like http://localhost:5173',
    ),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // Step 1 - authentication
  JWT_SECRET: z
    .string({ error: 'is required' })
    .min(32, 'must be at least 32 characters (use a long random value)'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'must look like 7d, 12h or 30m')
    .default('7d'),
  COOKIE_DOMAIN: z.string().optional().transform((v) => v || undefined),
  GOOGLE_CLIENT_ID: z.string().optional().transform((v) => v || undefined),

  // Step 2 - media (optional: uploads are disabled until all three are set)
  CLOUDINARY_CLOUD_NAME: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().regex(/^[a-z0-9_-]+$/i, 'must be a Cloudinary cloud name').optional()),
  CLOUDINARY_API_KEY: z.string().optional().transform((v) => v || undefined),
  CLOUDINARY_API_SECRET: z.string().optional().transform((v) => v || undefined),

  // News import from Instagram via Apify (optional: Fetch News is off until APIFY_TOKEN is set).
  // The token stays on the server; the browser only ever calls this API.
  APIFY_TOKEN: z.string().optional().transform((v) => v || undefined),
  // Shared secret a scheduled Apify task sends to POST /integrations/apify/news-import.
  // The webhook is off (404) until it is set.
  APIFY_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().min(24, 'must be at least 24 characters (use a long random value)').optional()),
  NEWS_IMPORT_INSTAGRAM_USERNAME: z
    .string()
    .regex(/^[a-z0-9._]{1,30}$/, 'must be an Instagram username like snewstenali')
    .default('snewstenali'),
  NEWS_IMPORT_SOURCE_NAME: z.string().trim().min(2).max(100).default('S News Tenali'),
  NEWS_IMPORT_MAX_POSTS: z.coerce.number().int().min(1).max(50).default(10),

  // Step 10 - monitoring (optional): errors are reported only when set
  SENTRY_DSN: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.url({ protocol: /^https$/, message: 'must be an https:// Sentry DSN' }).optional()),
});

/**
 * Production-only rules (Step 10): the app and API run over HTTPS, so every
 * allowed origin must be https, and the cookie domain must be a real domain.
 */
function productionProblems(env) {
  if (env.NODE_ENV !== 'production') return [];
  const problems = [];
  if (csv(env.CLIENT_ORIGIN).some((o) => !o.startsWith('https://'))) problems.push('CLIENT_ORIGIN must use https:// origins in production');
  if (env.COOKIE_DOMAIN && !/^\.?[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(env.COOKIE_DOMAIN)) {
    problems.push('COOKIE_DOMAIN must be a domain like .example.in');
  }
  if (/^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(env.MONGODB_URI)) problems.push('MONGODB_URI must not point at a local database in production');
  return problems;
}

export class EnvValidationError extends Error {
  constructor(problems) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

/** Parse and validate a source object (defaults to process.env). */
export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.') || 'env'} ${i.message}`);
    throw new EnvValidationError(problems);
  }
  const env = result.data;
  const production = productionProblems(env);
  if (production.length) throw new EnvValidationError(production);
  return Object.freeze({
    ...env,
    CLIENT_ORIGINS: csv(env.CLIENT_ORIGIN),
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  });
}

let cached;
/** Lazily-loaded, cached environment for modules that need configuration. */
export function getEnv() {
  if (!cached) cached = loadEnv();
  return cached;
}

/** Test helper: forget the cached env so a changed process.env is re-read. */
export function resetEnvCache() {
  cached = undefined;
}
