import path from 'node:path';

import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * The API on another host but served from this site: `/api/v1/*` is forwarded there (e.g. Vercel → Render). The
 * browser then only talks to this site, so the session cookies (SameSite=Lax) are first-party. Set it together
 * with `NEXT_PUBLIC_API_URL=/api/v1`; leave it unset when the API has its own address on the same site.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Docker: a self-contained server with only the files it uses. The tracing root is the monorepo root so the
  // workspace package (@offerleap/shared) is included (builds run from apps/web).
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  async rewrites() {
    return apiProxyTarget
      ? [{ source: '/api/v1/:path*', destination: `${apiProxyTarget}/api/v1/:path*` }]
      : [];
  },
};

export default withNextIntl(nextConfig);
