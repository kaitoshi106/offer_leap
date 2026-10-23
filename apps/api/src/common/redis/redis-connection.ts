import type { ConnectionOptions } from 'bullmq';

/**
 * @description BullMQ connection options from a Redis URL: `redis://user:password@host:port/db`, or `rediss://…`
 * for TLS (hosted Redis services). Credentials may be percent-encoded in the URL.
 * @param url - `REDIS_URL`.
 */
export function redisConnection(url: string): ConnectionOptions & { username?: string; password?: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    ...(parsed.protocol === 'rediss:' && { tls: { servername: parsed.hostname } }),
  };
}
