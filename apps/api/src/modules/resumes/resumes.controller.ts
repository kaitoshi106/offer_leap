import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ErrorCode,
  RESUME_MAX_BYTES,
  type ResumePreview,
  type ResumeSummary,
  type UploadResumeFields,
  uploadResumeFieldsSchema,
  ValidationRule,
} from '@offerleap/shared';

import { AllowIncompleteProfile, CurrentUser } from '../../common/decorators/auth.decorators';
import { AppException } from '../../common/errors/app.exception';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ResumesService, type UploadedResumeFile } from './resumes.service';

const TEN_MINUTES = 10 * 60_000;

/** `encodeURIComponent` leaves `'()*` as they are, but RFC 8187 (`filename*=`) needs them escaped too. */
const encodeRfc8187 = (value: string) =>
  encodeURIComponent(value).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
/** Opening a CV is cheap, but converting a DOCX isn't free: a generous cap (per client IP, like every limit). */
const VIEW_LIMIT = { default: { limit: 60, ttl: TEN_MINUTES } };

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
    description:
      'Returns 202. During onboarding the status is PENDING: poll `GET /resumes/{id}` until COMPLETED or FAILED. ' +
      'After onboarding the CV is only stored (UPLOADED). The same file again returns the existing CV with ' +
      '`reused: true`. At the CV limit, pass `replaceId` to delete that CV (and its analyses) in the same step.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        replaceId: { type: 'string', description: 'Optional: one of your CVs to delete to make room.' },
      },
    },
  })
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.COMMON_FILE_TOO_LARGE,
    ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE,
    ErrorCode.COMMON_RATE_LIMITED,
    ErrorCode.RESUME_LIMIT_REACHED,
    ErrorCode.COMMON_NOT_FOUND,
  )
  // During onboarding each upload costs an AI call: a few per client are plenty.
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
    @Body(new ZodValidationPipe(uploadResumeFieldsSchema)) fields: UploadResumeFields,
  ): Promise<ResumeSummary> {
    if (!file) {
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
        message: 'No file uploaded',
        fieldErrors: [{ field: 'file', rule: ValidationRule.REQUIRED }],
      });
    }
    return this.resumes.upload(user.sub, file, fields);
  }

  @ApiOperation({ summary: 'Your CVs, newest first' })
  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<ResumeSummary[]> {
    return this.resumes.list(user.sub);
  }

  @ApiOperation({ summary: 'Status of an uploaded CV and, once parsed, the suggested profile values' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @Get(':id')
  findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<ResumeSummary> {
    return this.resumes.findOwned(user.sub, id);
  }

  @ApiOperation({
    summary: 'The uploaded file itself, to view it',
    description:
      'Served inline with its detected type. Browsers can show PDFs and images; DOCX needs `/preview`.',
  })
  @ApiOkResponse({ description: 'The file bytes.' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND, ErrorCode.COMMON_RATE_LIMITED)
  @Throttle(VIEW_LIMIT)
  // Someone's CV: never kept by a shared cache.
  @Header('Cache-Control', 'private, no-store')
  @Get(':id/file')
  async file(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<StreamableFile> {
    const { data, mimeType, fileName } = await this.resumes.file(user.sub, id);
    return new StreamableFile(data, {
      type: mimeType,
      disposition: `inline; filename*=UTF-8''${encodeRfc8187(fileName)}`,
      length: data.length,
    });
  }

  @ApiOperation({ summary: 'A DOCX CV converted to HTML, for browsers that cannot show Word files' })
  @ApiOkResponse({ description: '`{ html }` — render it sandboxed, without scripts.' })
  @ApiErrors(
    ErrorCode.COMMON_NOT_FOUND,
    ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE,
    ErrorCode.COMMON_RATE_LIMITED,
  )
  @Throttle(VIEW_LIMIT)
  @Get(':id/preview')
  preview(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<ResumePreview> {
    return this.resumes.preview(user.sub, id);
  }

  @ApiOperation({ summary: 'Delete a CV, its file and the analyses made with it' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    return this.resumes.remove(user.sub, id);
  }
}
