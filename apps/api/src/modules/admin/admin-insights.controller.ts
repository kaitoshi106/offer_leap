import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminIndustry,
  type AiUsageQuery,
  aiUsageQuerySchema,
  type AiUsageStats,
  type CreateIndustryInput,
  createIndustrySchema,
  ErrorCode,
  Role,
  type UpdateIndustryInput,
  updateIndustrySchema,
} from '@offerleap/shared';

import { Roles } from '../../common/decorators/auth.decorators';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminIndustriesService } from './admin-industries.service';
import { AdminUsageService } from './admin-usage.service';

@ApiTags('admin')
@ApiCookieAuth('cookie')
@Roles(Role.ADMIN)
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_FORBIDDEN)
@Controller('admin')
export class AdminInsightsController {
  constructor(
    private readonly usage: AdminUsageService,
    private readonly industries: AdminIndustriesService,
  ) {}

  @ApiOperation({ summary: 'AI usage over the last N days (totals, per prompt, per day, top users)' })
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED)
  @Get('ai-usage')
  aiUsage(@Query(new ZodValidationPipe(aiUsageQuerySchema)) query: AiUsageQuery): Promise<AiUsageStats> {
    return this.usage.stats(query.days);
  }

  @ApiOperation({ summary: 'Industries with how many profiles use each' })
  @Get('industries')
  listIndustries(): Promise<AdminIndustry[]> {
    return this.industries.list();
  }

  @ApiOperation({ summary: 'Add an industry' })
  @ApiZodBody(createIndustrySchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.TAXONOMY_CODE_TAKEN)
  @Post('industries')
  createIndustry(
    @Body(new ZodValidationPipe(createIndustrySchema)) body: CreateIndustryInput,
  ): Promise<AdminIndustry> {
    return this.industries.create(body);
  }

  @ApiOperation({ summary: 'Rename an industry (the code never changes)' })
  @ApiZodBody(updateIndustrySchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.COMMON_NOT_FOUND)
  @Patch('industries/:code')
  updateIndustry(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(updateIndustrySchema)) body: UpdateIndustryInput,
  ): Promise<AdminIndustry> {
    return this.industries.update(code, body);
  }

  @ApiOperation({ summary: 'Delete an industry no profile uses' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND, ErrorCode.TAXONOMY_IN_USE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('industries/:code')
  removeIndustry(@Param('code') code: string): Promise<void> {
    return this.industries.remove(code);
  }
}
