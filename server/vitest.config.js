import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/tests/globalSetup.js'],
    setupFiles: ['./src/tests/setupEnv.js'],
    include: ['src/**/*.test.js'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
});
