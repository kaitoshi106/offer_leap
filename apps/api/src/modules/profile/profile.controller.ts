import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErrorCode, type ProfileValues } from '@offerleap/shared';

import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors } from '../../common/openapi/openapi.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { toProfileValues } from './profile.mapper';

@ApiTags('profile')
@ApiCookieAuth('cookie')
@Controller('profile')
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary: 'Current user profile',
    description: 'Requires a completed onboarding for USER accounts.',
  })
  @ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.ONBOARDING_REQUIRED)
  @Get()
  async me(@CurrentUser() user: AccessTokenPayload): Promise<ProfileValues> {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      include: { profile: true },
    });
    return toProfileValues(record, record.profile);
  }
}
