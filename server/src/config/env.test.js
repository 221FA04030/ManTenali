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
