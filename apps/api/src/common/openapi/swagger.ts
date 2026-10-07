import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_NAME, APP_TAGLINE } from '@offerleap/shared';

import { ACCESS_TOKEN_COOKIE } from '../../modules/auth/auth.cookies';

export const DOCS_PATH = 'api/docs';

/**
 * @description Serves Swagger UI at `/api/docs` and the raw spec at `/api/docs/openapi.json`.
 * Calls made from the UI run on the API's own origin, so the session cookies set by `login` are sent with the
 * following requests automatically — sign in once, then try protected endpoints.
 * @param app - Nest application (global prefix already set).
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle(`${APP_NAME} API`)
    .setDescription(
      `${APP_TAGLINE}\n\nErrors always use the \`ApiErrorResponse\` shape; translate \`code\` on the client. ` +
        'Sign in with **POST /auth/login** (or verify-email): the access/refresh cookies are then sent automatically.',
    )
    .setVersion('0.1.0')
    .addCookieAuth(ACCESS_TOKEN_COOKIE, { type: 'apiKey', in: 'cookie', name: ACCESS_TOKEN_COOKIE }, 'cookie')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: `${DOCS_PATH}/openapi.json`,
    customSiteTitle: `${APP_NAME} API`,
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tryItOutEnabled: true },
  });
}
