import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { setupSwagger } from './common/openapi/swagger';
import type { Env } from './config/env.schema';

export const API_PREFIX = 'api/v1';

/**
 * @description Cross-cutting HTTP settings shared by `main.ts` and the e2e tests, so tests exercise exactly
 * what runs in production.
 * @param app - Nest application before `listen()`.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  app.setGlobalPrefix(API_PREFIX);
  app.use(
    helmet({
      // Locally the API runs on plain http://localhost; upgrading the docs' assets to https would break them.
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: isProduction ? [] : null } },
    }),
  );
  app.use(cookieParser());
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });
  app.enableShutdownHooks();

  // API docs are a development tool; production exposes no schema to the public.
  if (!isProduction) setupSwagger(app);
}
