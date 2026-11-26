import { describe, it, expect } from 'vitest';
import { loadEnv, EnvValidationError } from './env.js';
import { redactUri } from './db.js';

const valid = {
  NODE_ENV: 'development',
  PORT: '4000',
  MONGODB_URI: 'mongodb+srv://user:secret-pass@cluster.example.net/db',
  CLIENT_ORIGIN: 'http://localhost:5173, https://manatenali.in',
  JWT_SECRET: 'x'.repeat(40),
};

describe('env validation', () => {
  it('accepts a valid configuration and splits origins', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.CLIENT_ORIGINS).toEqual(['http://localhost:5173', 'https://manatenali.in']);
    expect(env.isProduction).toBe(false);
  });

  it('refuses to start when MONGODB_URI is missing', () => {
    const { MONGODB_URI: _omit, ...rest } = valid;
    expect(() => loadEnv(rest)).toThrow(EnvValidationError);
    expect(() => loadEnv(rest)).toThrow(/MONGODB_URI/);
  });

  it('rejects a non-mongodb URI without echoing its value', () => {
    const secretish = 'postgres://admin:SuperSecret123@host/db';
    let caught;
    try {
      loadEnv({ ...valid, MONGODB_URI: secretish });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    expect(caught.message).toMatch(/MONGODB_URI/);
    expect(caught.message).not.toContain('SuperSecret123');
  });

  it('rejects malformed CLIENT_ORIGIN values', () => {
    expect(() => loadEnv({ ...valid, CLIENT_ORIGIN: 'localhost:5173/' })).toThrow(/CLIENT_ORIGIN/);
  });
});

describe('redactUri', () => {
  it('removes connection strings from error text', () => {
    const msg = 'failed to connect mongodb+srv://u:p@host/db?x=1 after 3 tries';
    expect(redactUri(msg)).toBe('failed to connect [redacted-uri] after 3 tries');
  });
});

describe('production rules (Step 10)', () => {
  const prod = { ...valid, NODE_ENV: 'production', CLIENT_ORIGIN: 'https://manatenali.in' };

  it('accepts an https production configuration with an optional Sentry DSN', () => {
    const env = loadEnv({ ...prod, COOKIE_DOMAIN: '.manatenali.in', SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1' });
    expect(env).toMatchObject({ isProduction: true, COOKIE_DOMAIN: '.manatenali.in', SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1' });
  });

  it('refuses http origins, a bad cookie domain or a local database in production - naming problems, never values', () => {
    const fail = (overrides) => {
      try {
        loadEnv({ ...prod, ...overrides });
      } catch (err) {
        expect(err).toBeInstanceOf(EnvValidationError);
        return err.message;
      }
      throw new Error('expected a validation error');
    };
    expect(fail({ CLIENT_ORIGIN: 'https://manatenali.in,http://localhost:5173' })).toMatch(/CLIENT_ORIGIN must use https/);
    expect(fail({ COOKIE_DOMAIN: 'not a domain' })).toMatch(/COOKIE_DOMAIN/);
    const local = fail({ MONGODB_URI: 'mongodb://localhost:27017/x' });
    expect(local).toMatch(/MONGODB_URI must not point at a local database/);
    expect(local).not.toMatch(/localhost:27017/);
    expect(fail({ SENTRY_DSN: 'http://insecure' })).toMatch(/SENTRY_DSN/);
    // the same values are fine outside production
    expect(loadEnv({ ...valid, MONGODB_URI: 'mongodb://localhost:27017/x' }).isProduction).toBe(false);
  });
});
