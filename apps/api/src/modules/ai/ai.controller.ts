import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AiQuotaStatus, ErrorCode } from '@offerleap/shared';

import { AllowIncompleteProfile, CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors } from '../../common/openapi/openapi.decorators';
import { AiQuotaService } from './ai-quota.service';

@ApiTags('ai')
@ApiCookieAuth('cookie')
@AllowIncompleteProfile()
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED)
@Controller('ai')
export class AiController {
  constructor(private readonly quota: AiQuotaService) {}

  @ApiOperation({ summary: 'Your AI calls in the last 24 hours and your limit (null = unlimited)' })
  @Get('quota')
  status(@CurrentUser() user: AccessTokenPayload): Promise<AiQuotaStatus> {
    return this.quota.status(user.sub);
  }
}
