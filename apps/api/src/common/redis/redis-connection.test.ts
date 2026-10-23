import { describe, expect, it } from 'vitest';

import { redisConnection } from './redis-connection';

describe('redisConnection', () => {
  it('reads host, port, credentials and database from a redis:// URL', () => {
    expect(redisConnection('redis://user:secret@cache.example.com:6380/2')).toEqual({
      host: 'cache.example.com',
      port: 6380,
      username: 'user',
      password: 'secret',
      db: 2,
    });
    expect(redisConnection('redis://localhost:6379')).toMatchObject({ host: 'localhost', port: 6379, db: 0 });
  });

  it('connects over TLS for a rediss:// URL, as hosted Redis services require', () => {
    expect(redisConnection('rediss://default:secret@redis.cloud.example:12345')).toMatchObject({
      host: 'redis.cloud.example',
      port: 12345,
      password: 'secret',
      tls: { servername: 'redis.cloud.example' },
    });
  });

  it('decodes special characters in the password', () => {
    expect(redisConnection('redis://default:p%40ss%3Aword@localhost:6379').password).toBe('p@ss:word');
  });
});
