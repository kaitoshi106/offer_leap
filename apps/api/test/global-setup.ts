import { execSync } from 'node:child_process';

/**
 * Runs once before the e2e suite, in the main Vitest process: applies all migrations to the test database.
 * Refuses any database whose name doesn't end in `_test`, so a misconfigured env can't wipe dev data.
 */
export default function setup(): void {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST is not set');

  const database = new URL(url).pathname.slice(1);
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to run e2e tests against a non-test database: ${database}`);
  }
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
