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
});

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
