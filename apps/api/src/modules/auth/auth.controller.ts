import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthSession,
  authSessionSchema,
  type AuthUser,
  authUserSchema,
  type ChangePasswordInput,
  changePasswordSchema,
  DEFAULT_LOCALE,
  emailSchema,
  type EmailOnlyInput,
  ErrorCode,
  emailOnlySchema,
  isLocale,
  type Locale,
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
  type TokenOnlyInput,
  tokenOnlySchema,
} from '@offerleap/shared';
import type { Response } from 'express';
import { z } from 'zod';

import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { type AccessTokenPayload, type AppRequest, clientInfo } from '../../common/http/request';
import { ApiErrors, ApiZodBody, ApiZodResponse } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { Env } from '../../config/env.schema';
import { clearSessionCookies, REFRESH_TOKEN_COOKIE, setSessionCookies } from './auth.cookies';
import { AuthService, type SessionResult } from './auth.service';

/** Tight limit for endpoints that are attractive to brute force or email spam: 5 requests / minute / IP. */
const SENSITIVE = { default: { limit: 5, ttl: 60_000 } };

const registeredSchema = z.object({ email: emailSchema });
const SESSION_SET = 'Session started. Sets the `ol_at` (access) and `ol_rt` (refresh) httpOnly cookies.';

/**
 * @description Picks the user's language from `Accept-Language` (e.g. "en-US,en;q=0.9" → "en").
 * @param request - Incoming request.
 * @returns A supported locale.
 */
function requestLocale(request: AppRequest): Locale {
  const primary = request.headers['accept-language']?.split(',')[0]?.split('-')[0]?.trim().toLowerCase();
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}

@ApiTags('auth')
@ApiErrors(ErrorCode.COMMON_RATE_LIMITED, ErrorCode.COMMON_INTERNAL_ERROR)
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Public()
  @Throttle(SENSITIVE)
  @ApiOperation({
    summary: 'Create an account',
    description:
      'Creates an unverified account and emails a verification link (Mailpit locally). No session yet.',
  })
  @ApiZodBody(registerSchema)
  @ApiZodResponse(201, registeredSchema, 'Account created, verification email queued.')
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.AUTH_EMAIL_TAKEN)
  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() request: AppRequest,
  ): Promise<{ email: string }> {
    return this.auth.register(body, requestLocale(request));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email', description: 'Consumes the emailed token and signs the user in.' })
  @ApiZodBody(tokenOnlySchema)
  @ApiZodResponse(200, authSessionSchema, SESSION_SET)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.AUTH_TOKEN_INVALID, ErrorCode.AUTH_TOKEN_EXPIRED)
  @Post('verify-email')
  async verifyEmail(
    @Body(new ZodValidationPipe(tokenOnlySchema)) body: TokenOnlyInput,
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    return this.respondWithSession(await this.auth.verifyEmail(body.token, clientInfo(request)), response);
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Resend the verification email',
    description: 'Always 202 for unknown emails, so the endpoint cannot be used to discover accounts.',
  })
  @ApiZodBody(emailOnlySchema)
  @ApiAcceptedResponse({ description: 'Accepted.' })
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.AUTH_EMAIL_ALREADY_VERIFIED)
  @Post('resend-verification')
  async resendVerification(
    @Body(new ZodValidationPipe(emailOnlySchema)) body: EmailOnlyInput,
  ): Promise<void> {
    await this.auth.resendVerification(body.email);
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in' })
  @ApiZodBody(loginSchema)
  @ApiZodResponse(200, authSessionSchema, SESSION_SET)
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.AUTH_INVALID_CREDENTIALS,
    ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
    ErrorCode.AUTH_ACCOUNT_LOCKED,
  )
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    return this.respondWithSession(await this.auth.login(body, clientInfo(request)), response);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the session',
    description:
      'Uses the `ol_rt` cookie (sent automatically after login). Returns new cookies; the old refresh token stops working.',
  })
  @ApiZodResponse(200, authSessionSchema, SESSION_SET)
  @ApiErrors(
    ErrorCode.AUTH_UNAUTHENTICATED,
    ErrorCode.AUTH_TOKEN_INVALID,
    ErrorCode.AUTH_TOKEN_EXPIRED,
    ErrorCode.AUTH_ACCOUNT_LOCKED,
  )
  @Post('refresh')
  async refresh(
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    try {
      const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
      return this.respondWithSession(await this.auth.refresh(refreshToken, clientInfo(request)), response);
    } catch (error) {
      // A dead refresh token is useless: clear it so the client stops retrying with it.
      clearSessionCookies(response, this.secureCookies);
      throw error;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out', description: 'Revokes the current session and clears the cookies.' })
  @ApiNoContentResponse({ description: 'Signed out.' })
  @Post('logout')
  async logout(@Req() request: AppRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined);
    clearSessionCookies(response, this.secureCookies);
  }

  @ApiOperation({ summary: 'Current user' })
  @ApiCookieAuth('cookie')
  @ApiZodResponse(200, authUserSchema, 'The signed-in user.')
  @ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED)
  @Get('me')
  me(@CurrentUser() user: AccessTokenPayload): Promise<AuthUser> {
    return this.auth.me(user.sub);
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request a password reset email',
    description: 'Always 202. Unknown, unverified and root accounts receive nothing.',
  })
  @ApiZodBody(emailOnlySchema)
  @ApiAcceptedResponse({ description: 'Accepted.' })
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED)
  @Post('forgot-password')
  async forgotPassword(@Body(new ZodValidationPipe(emailOnlySchema)) body: EmailOnlyInput): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set a new password from the emailed token',
    description: 'Signs out every session.',
  })
  @ApiZodBody(resetPasswordSchema)
  @ApiNoContentResponse({ description: 'Password changed.' })
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.AUTH_TOKEN_INVALID,
    ErrorCode.AUTH_TOKEN_EXPIRED,
    ErrorCode.AUTH_PASSWORD_CHANGE_NOT_ALLOWED,
  )
  @Post('reset-password')
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<void> {
    await this.auth.resetPassword(body);
  }

  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password',
    description: 'Ends every other session and starts a new one. Not allowed for the root admin.',
  })
  @ApiCookieAuth('cookie')
  @ApiZodBody(changePasswordSchema)
  @ApiZodResponse(200, authSessionSchema, SESSION_SET)
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.AUTH_UNAUTHENTICATED,
    ErrorCode.AUTH_INVALID_CREDENTIALS,
    ErrorCode.AUTH_PASSWORD_CHANGE_NOT_ALLOWED,
  )
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() request: AppRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    return this.respondWithSession(
      await this.auth.changePassword(user.sub, body, clientInfo(request)),
      response,
    );
  }

  private respondWithSession({ user, tokens }: SessionResult, response: Response): AuthSession {
    setSessionCookies(response, tokens, this.secureCookies);
    return { user, accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString() };
  }
}
