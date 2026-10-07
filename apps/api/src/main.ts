import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { API_PREFIX, configureApp } from './app.setup';
import { DOCS_PATH } from './common/openapi/swagger';
import { type Env } from './config/env.schema';

/**
 * @description Creates the Nest application, applies cross-cutting HTTP settings and starts listening.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API ready at http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    Logger.log(`API docs at http://localhost:${port}/${DOCS_PATH}`, 'Bootstrap');
  }
}

void bootstrap();
