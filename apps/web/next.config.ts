import path from 'node:path';

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Docker: a self-contained server with only the files it uses. The tracing root is the monorepo root so the
  // workspace package (@offerleap/shared) is included (builds run from apps/web).
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
};

export default withNextIntl(nextConfig);
