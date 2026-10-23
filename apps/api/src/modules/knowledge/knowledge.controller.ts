import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type CreateTextDocumentInput,
  createTextDocumentSchema,
  ErrorCode,
  KNOWLEDGE_LIMITS,
  type KnowledgeDocument,
  type KnowledgeMatch,
  type KnowledgeSearch,
  knowledgeSearchSchema,
  ValidationRule,
} from '@offerleap/shared';

import { CurrentUser } from '../../common/decorators/auth.decorators';
import { AppException } from '../../common/errors/app.exception';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { callAi } from '../ai/call-ai';
import { KnowledgeService } from './knowledge.service';

const ONE_MINUTE = 60_000;
const ONE_HOUR = 60 * ONE_MINUTE;

@ApiTags('knowledge')
@ApiCookieAuth('cookie')
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED, ErrorCode.ONBOARDING_REQUIRED)
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @ApiOperation({ summary: 'Your documents, newest first' })
  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<KnowledgeDocument[]> {
    return this.knowledge.list(user.sub);
  }

  @ApiOperation({ summary: 'Upload a document (PDF, DOCX, TXT, MD; max 5 MB) — processed in the background' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.COMMON_FILE_TOO_LARGE,
    ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE,
    ErrorCode.KNOWLEDGE_LIMIT_REACHED,
  )
  @Throttle({ default: { limit: 30, ttl: ONE_HOUR } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: KNOWLEDGE_LIMITS.fileBytes, files: 1 },
      defParamCharset: 'utf8',
    }),
  )
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('upload')
  upload(
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
  ): Promise<KnowledgeDocument> {
    if (!file) {
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
        fieldErrors: [{ field: 'file', rule: ValidationRule.REQUIRED }],
      });
    }
    return this.knowledge.upload(user.sub, file);
  }

  @ApiOperation({ summary: 'Add a document from pasted text' })
  @ApiZodBody(createTextDocumentSchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.KNOWLEDGE_LIMIT_REACHED)
  @Throttle({ default: { limit: 30, ttl: ONE_HOUR } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('text')
  createText(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createTextDocumentSchema)) body: CreateTextDocumentInput,
  ): Promise<KnowledgeDocument> {
    return this.knowledge.createText(user.sub, body);
  }

  @ApiOperation({
    summary: 'Search your documents by meaning',
    description:
      'Returns the closest passages with their cosine similarity — what the AI features would be given.',
  })
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.AI_UNAVAILABLE)
  // Each search embeds the query with the AI provider (and isn't counted in the daily quota).
  @Throttle({ default: { limit: 30, ttl: ONE_MINUTE } })
  @Get('search')
  search(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(knowledgeSearchSchema)) query: KnowledgeSearch,
  ): Promise<KnowledgeMatch[]> {
    return callAi(() => this.knowledge.search(user.sub, query.q, { limit: query.limit }));
  }

  @ApiOperation({ summary: 'Delete a document and its passages' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    return this.knowledge.remove(user.sub, id);
  }
}
