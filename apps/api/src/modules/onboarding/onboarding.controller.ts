import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ErrorCode,
  type OnboardingState,
  type SaveOnboardingStep,
  saveOnboardingStepSchema,
} from '@offerleap/shared';
import type { Response } from 'express';

import { AllowIncompleteProfile, CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { Env } from '../../config/env.schema';
import { setOnboardingFlagCookie } from '../auth/auth.cookies';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@ApiCookieAuth('cookie')
@AllowIncompleteProfile()
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED)
@Controller('onboarding')
export class OnboardingController {
  private readonly secureCookies: boolean;
  private readonly sessionDays: number;

  constructor(
    private readonly onboarding: OnboardingService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
    this.sessionDays = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
  }

  @ApiOperation({ summary: 'Saved draft and the step to resume at' })
  @Get()
  state(@CurrentUser() user: AccessTokenPayload): Promise<OnboardingState> {
    return this.onboarding.getState(user.sub);
  }

  @ApiOperation({
    summary: 'Save one wizard step',
    description: '`step` selects which fields `values` must contain: personal, career or preferences.',
  })
  @ApiZodBody(saveOnboardingStepSchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED)
  @Put('draft')
  saveStep(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(saveOnboardingStepSchema)) body: SaveOnboardingStep,
  ): Promise<OnboardingState> {
    return this.onboarding.saveStep(user.sub, body);
  }

  @ApiOperation({
    summary: 'Finish onboarding',
    description: 'Validates the whole saved draft. On success the profile is complete and other APIs unlock.',
  })
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED)
  @HttpCode(HttpStatus.OK)
  @Post('complete')
  async complete(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OnboardingState> {
    const state = await this.onboarding.complete(user.sub);
    // The web app's proxy now sends this account to the dashboard instead of onboarding, before rendering.
    const expires = new Date(Date.now() + this.sessionDays * 24 * 60 * 60 * 1000);
    setOnboardingFlagCookie(response, 'done', this.secureCookies, expires);
    return state;
  }
}
