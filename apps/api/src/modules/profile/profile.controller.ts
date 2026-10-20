import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ErrorCode,
  type ProfileValues,
  type UpdateProfileSection,
  updateProfileSectionSchema,
} from '@offerleap/shared';

import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiCookieAuth('cookie')
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.ONBOARDING_REQUIRED)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @ApiOperation({
    summary: 'Current user profile',
    description: 'Requires a completed onboarding for USER accounts.',
  })
  @Get()
  me(@CurrentUser() user: AccessTokenPayload): Promise<ProfileValues> {
    return this.profile.get(user.sub);
  }

  @ApiOperation({
    summary: 'Edit one section of the profile',
    description:
      '`section` is personal, career or preferences; `values` follow the same rules as onboarding.',
  })
  @ApiZodBody(updateProfileSectionSchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED)
  @Put('sections')
  async saveSection(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(updateProfileSectionSchema)) body: UpdateProfileSection,
  ): Promise<ProfileValues> {
    await this.profile.saveSection(user.sub, body);
    return this.profile.get(user.sub);
  }
}
