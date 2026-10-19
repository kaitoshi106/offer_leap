import { config as loadEnv } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Same .env lookup as the app (apps/api first, then the repo root).
loadEnv({ path: ['.env', '../../.env'], quiet: true });

// Read by the e2e global setup (same process) and passed to test workers below.
process.env.DATABASE_URL_TEST ??= 'postgresql://offerleap:offerleap@localhost:5432/offerleap_test';
const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;

export default defineConfig({
  // esbuild (Vite's default) drops decorator metadata, which Nest's dependency injection needs.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          // process.env wins over .env files in @nestjs/config, so these override local settings.
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: TEST_DATABASE_URL,
            JWT_ACCESS_SECRET: 'e2e-secret-that-is-long-enough-for-hs256-signing',
            // Never call a real AI from tests, whatever the local .env says.
            AI_PROVIDER: 'mock',
            STORAGE_DIR: 'storage/test',
          },
          include: ['test/**/*.e2e.test.ts'],
          globalSetup: ['test/global-setup.ts'],
          // One database: run files one after another.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
