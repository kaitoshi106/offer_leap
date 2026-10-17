import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ErrorCode,
  type OnboardingState,
  type SaveOnboardingStep,
  saveOnboardingStepSchema,
} from '@offerleap/shared';

import { AllowIncompleteProfile, CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@ApiCookieAuth('cookie')
@AllowIncompleteProfile()
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

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
  complete(@CurrentUser() user: AccessTokenPayload): Promise<OnboardingState> {
    return this.onboarding.complete(user.sub);
  }
}
