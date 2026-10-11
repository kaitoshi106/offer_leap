import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for full user flows against the real web app + API (+ Mailpit for emails).
 * Prerequisites: `pnpm infra:up` and a migrated dev database.
 *
 * Default: reuses (or starts) `pnpm dev` on :3000 / :4000.
 * Isolated run next to your own dev servers: `E2E_WEB_PORT=3100 E2E_API_PORT=4100 pnpm test:browser`
 * (start the web app with `NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1` and the API with
 * `NODE_ENV=test API_PORT=4100 WEB_ORIGIN=http://localhost:3100`).
 * A reused `pnpm dev` API keeps its rate limits (5 sign-ups / logins per minute), so rerun after a minute.
 */
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3000);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4000);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Auth endpoints are rate limited per IP; keep the run sequential and small.
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @offerleap/api dev',
      cwd: '../..',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      // NODE_ENV=test turns off rate limiting, which repeated runs would otherwise hit.
      env: { API_PORT: String(API_PORT), WEB_ORIGIN: `http://localhost:${WEB_PORT}`, NODE_ENV: 'test' },
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @offerleap/web exec next dev --port ${WEB_PORT}`,
      cwd: '../..',
      url: `http://localhost:${WEB_PORT}/vi`,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}/api/v1` },
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
