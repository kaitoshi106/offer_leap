import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AccountExport,
  type DeleteAccountInput,
  deleteAccountSchema,
  ErrorCode,
} from '@offerleap/shared';
import type { Response } from 'express';

import { AllowIncompleteProfile, CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { Env } from '../../config/env.schema';
import { clearSessionCookies } from '../auth/auth.cookies';
import { AccountService } from './account.service';

/** Password guessing through the delete endpoint gets the same limit as sign-in: 5 requests / minute / IP. */
const SENSITIVE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('account')
@ApiCookieAuth('cookie')
// Someone who signed up and changed their mind must be able to leave before finishing onboarding.
@AllowIncompleteProfile()
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.COMMON_RATE_LIMITED)
@Controller('account')
export class AccountController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly account: AccountService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  @Throttle(SENSITIVE)
  @ApiOperation({
    summary: 'Download my data',
    description: 'All data the user created, as one JSON file (`Content-Disposition: attachment`).',
  })
  @ApiOkResponse({ description: 'The export.' })
  @Get('export')
  async export(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccountExport> {
    const data = await this.account.export(user.sub);
    const date = data.exportedAt.slice(0, 10);
    response.setHeader('Content-Disposition', `attachment; filename="offerleap-export-${date}.json"`);
    response.setHeader('Cache-Control', 'no-store');
    return data;
  }

  @Throttle(SENSITIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete my account',
    description:
      'Needs the current password. Deletes the account, its data and files, and signs out. Not for the root admin.',
  })
  @ApiZodBody(deleteAccountSchema)
  @ApiNoContentResponse({ description: 'Deleted; session cookies cleared.' })
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.AUTH_INVALID_CREDENTIALS,
    ErrorCode.AUTH_ACCOUNT_DELETE_NOT_ALLOWED,
  )
  @Delete()
  async delete(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.account.delete(user.sub, body);
    clearSessionCookies(response, this.secureCookies);
  }
}
