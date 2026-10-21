import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthProviders,
  ErrorCode,
  type OAuthStartQuery,
  oauthStartQuerySchema,
  type SignInMethods,
} from '@offerleap/shared';
import type { Response } from 'express';

import { AllowIncompleteProfile, CurrentUser, Public } from '../../../common/decorators/auth.decorators';
import { AppException } from '../../../common/errors/app.exception';
import { type AccessTokenPayload, type AppRequest, clientInfo } from '../../../common/http/request';
import { ApiErrors } from '../../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import type { Env } from '../../../config/env.schema';
import { clearSessionCookies, setSessionCookies } from '../auth.cookies';
import { clearFlowCookie, OAUTH_FLOW_COOKIE, oauthCallbackUrl, setFlowCookie } from './oauth.cookies';
import { OAuthService } from './oauth.service';

/** Flows that act on the signed-in account. */
enum AccountIntent {
  link = 'link',
  delete = 'delete',
}

/**
 * Sign in with Google. The browser navigates (no fetch): start → Google → callback → back to the web app with
 * session cookies set, or with `?error=<code>` on the login or settings page.
 */
@ApiTags('auth')
@AllowIncompleteProfile()
@ApiErrors(ErrorCode.COMMON_RATE_LIMITED, ErrorCode.COMMON_INTERNAL_ERROR)
@Controller('auth')
export class OAuthController {
  private readonly secureCookies: boolean;
  private readonly callbackUrl: string;
  private readonly webOrigin: string;

  constructor(
    private readonly oauth: OAuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
    this.callbackUrl = oauthCallbackUrl(config.get('API_PUBLIC_URL', { infer: true }));
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  @Public()
  @ApiOperation({
    summary: 'Sign-in providers',
    description: 'Which providers are configured (the web app hides the others).',
  })
  @Get('providers')
  providers(): AuthProviders {
    return this.oauth.providers();
  }

  @Public()
  @ApiOperation({
    summary: 'Sign in or sign up with Google',
    description: 'Redirects to Google. Open it as a page (link), not with fetch.',
  })
  @Get('google')
  async startLogin(
    @Query(new ZodValidationPipe(oauthStartQuerySchema)) query: OAuthStartQuery,
    @Res() response: Response,
  ): Promise<void> {
    await this.redirectToGoogle(response, () => this.oauth.start('login', query), query.locale, '/login');
  }

  @ApiCookieAuth('cookie')
  @ApiOperation({
    summary: 'Link Google, or confirm deleting the account with Google',
    description:
      "For the signed-in user, submitted as a form (POST, so other sites can't trigger it with a link). " +
      '`delete` asks Google for a fresh sign-in and deletes the account when it is the linked Google account.',
  })
  @Post('google/:intent')
  async startForAccount(
    @CurrentUser() user: AccessTokenPayload,
    @Param('intent', new ParseEnumPipe(AccountIntent)) intent: AccountIntent,
    @Query(new ZodValidationPipe(oauthStartQuerySchema)) query: OAuthStartQuery,
    @Res() response: Response,
  ): Promise<void> {
    await this.redirectToGoogle(
      response,
      () => this.oauth.start(intent, query, user.sub),
      query.locale,
      '/settings',
    );
  }

  @Public()
  @ApiOperation({ summary: 'Google callback', description: 'Google redirects here; ends on the web app.' })
  @Get('google/callback')
  async callback(@Req() request: AppRequest, @Res() response: Response): Promise<void> {
    // Rebuilt from the configured public URL: behind a proxy the request's own host may differ from the one
    // registered at Google, and the token exchange must repeat it exactly.
    const url = new URL(this.callbackUrl);
    url.search = new URL(request.originalUrl, 'http://localhost').search;
    const outcome = await this.oauth.finish(
      url,
      request.cookies?.[OAUTH_FLOW_COOKIE] as string | undefined,
      clientInfo(request),
    );
    clearFlowCookie(response, this.secureCookies);
    if (outcome.session) setSessionCookies(response, outcome.session.tokens, this.secureCookies);
    if (outcome.signOut) clearSessionCookies(response, this.secureCookies);
    response.redirect(HttpStatus.FOUND, outcome.redirectTo);
  }

  @ApiCookieAuth('cookie')
  @ApiOperation({
    summary: 'My sign-in methods',
    description: 'Whether a password is set, and linked providers.',
  })
  @ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED)
  @Get('sign-in-methods')
  signInMethods(@CurrentUser() user: AccessTokenPayload): Promise<SignInMethods> {
    return this.oauth.signInMethods(user.sub);
  }

  @ApiCookieAuth('cookie')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink Google', description: 'Refused while the account has no password.' })
  @ApiNoContentResponse({ description: 'Unlinked.' })
  @ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_OAUTH_UNLINK_NOT_ALLOWED)
  @Delete('identities/google')
  unlink(@CurrentUser() user: AccessTokenPayload): Promise<void> {
    return this.oauth.unlink(user.sub);
  }

  /**
   * @description Sets the flow cookie and sends the browser to Google (303 so a form POST continues as a GET).
   * A flow that can't start (Google not configured) returns to the page it came from with the error code.
   */
  private async redirectToGoogle(
    response: Response,
    start: () => Promise<{ url: string; flowToken: string }>,
    locale: string,
    back: string,
  ): Promise<void> {
    try {
      const { url, flowToken } = await start();
      setFlowCookie(response, flowToken, this.secureCookies);
      response.redirect(HttpStatus.SEE_OTHER, url);
    } catch (error) {
      if (!(error instanceof AppException)) throw error;
      const url = new URL(`/${locale}${back}`, this.webOrigin);
      url.searchParams.set('error', error.code);
      response.redirect(HttpStatus.SEE_OTHER, url.toString());
    }
  }
}
