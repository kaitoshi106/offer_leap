import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorCode, RESUME_MAX_BYTES, type ResumeSummary, ValidationRule } from '@offerleap/shared';

import { AllowIncompleteProfile, CurrentUser } from '../../common/decorators/auth.decorators';
import { AppException } from '../../common/errors/app.exception';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors } from '../../common/openapi/openapi.decorators';
import { ResumesService, type UploadedResumeFile } from './resumes.service';

const TEN_MINUTES = 10 * 60_000;

@ApiTags('resumes')
@ApiCookieAuth('cookie')
// Uploading a CV is the first onboarding step.
@AllowIncompleteProfile()
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED)
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @ApiOperation({
    summary: 'Upload a CV (PDF, DOCX, PNG, JPEG, WEBP; max 10 MB)',
    description: 'Returns 202 with status PENDING. Poll `GET /resumes/{id}` until COMPLETED or FAILED.',
  })
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
    ErrorCode.COMMON_RATE_LIMITED,
  )
  // Each upload costs an AI call: a few per user are plenty.
  @Throttle({ default: { limit: 5, ttl: TEN_MINUTES } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: RESUME_MAX_BYTES, files: 1 },
      // Browsers send UTF-8 file names ("CV Nguyễn Văn An.pdf"); multer's default would decode them as latin1.
      defParamCharset: 'utf8',
    }),
  )
  @HttpCode(HttpStatus.ACCEPTED)
  @Post()
  upload(
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFile() file: UploadedResumeFile | undefined,
  ): Promise<ResumeSummary> {
    if (!file) {
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
        message: 'No file uploaded',
        fieldErrors: [{ field: 'file', rule: ValidationRule.REQUIRED }],
      });
    }
    return this.resumes.upload(user.sub, file);
  }

  @ApiOperation({ summary: 'Status of an uploaded CV and, once parsed, the suggested profile values' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @Get(':id')
  findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<ResumeSummary> {
    return this.resumes.findOwned(user.sub, id);
  }
}
