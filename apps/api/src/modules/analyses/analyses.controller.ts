import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AnalysisDetail,
  type AnalysisSummary,
  type CreateAnalysis,
  createAnalysisSchema,
  ErrorCode,
  type PageQuery,
  pageQuerySchema,
  type Paginated,
} from '@offerleap/shared';

import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AnalysesService } from './analyses.service';

const ONE_HOUR = 60 * 60_000;

@ApiTags('analyses')
@ApiCookieAuth('cookie')
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED, ErrorCode.ONBOARDING_REQUIRED)
@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analyses: AnalysesService) {}

  @ApiOperation({
    summary: 'Compare one of your CVs with a job description',
    description: 'Returns 202 with status PENDING. Poll `GET /analyses/{id}` until COMPLETED or FAILED.',
  })
  @ApiZodBody(createAnalysisSchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.COMMON_RATE_LIMITED)
  // Each analysis costs an AI call.
  @Throttle({ default: { limit: 20, ttl: ONE_HOUR } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createAnalysisSchema)) body: CreateAnalysis,
  ): Promise<AnalysisDetail> {
    return this.analyses.create(user.sub, body);
  }

  @ApiOperation({
    summary: 'Your analyses, newest first',
    description: '`?page=&pageSize=` (10, 50 or 100).',
  })
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED)
  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<Paginated<AnalysisSummary>> {
    return this.analyses.list(user.sub, query);
  }

  @ApiOperation({ summary: 'Status and, once done, the result of an analysis' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @Get(':id')
  findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<AnalysisDetail> {
    return this.analyses.findOwned(user.sub, id);
  }

  @ApiOperation({ summary: 'Delete an analysis' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    return this.analyses.remove(user.sub, id);
  }
}
