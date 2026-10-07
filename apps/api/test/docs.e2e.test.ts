import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestContext } from './support/test-app';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.app.close();
});

describe('API docs', () => {
  it('serves Swagger UI', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/api/docs').expect(200);
    expect(response.text).toContain('swagger-ui');
  });

  it('publishes an OpenAPI spec generated from the shared Zod schemas', async () => {
    const { body } = await request(ctx.app.getHttpServer()).get('/api/docs/openapi.json').expect(200);
    const login = body.paths['/api/v1/auth/login'].post;

    expect(login.requestBody.content['application/json'].schema).toMatchObject({
      type: 'object',
      required: ['email', 'password'],
      properties: { email: expect.any(Object), password: expect.any(Object) },
    });
    expect(Object.keys(login.responses)).toEqual(
      expect.arrayContaining(['200', '401', '403', '422', '423', '429']),
    );
    expect(body.components.securitySchemes).toHaveProperty('cookie');
  });
});
