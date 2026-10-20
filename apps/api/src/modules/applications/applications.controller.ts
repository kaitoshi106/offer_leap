import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type ApplicationDetail,
  type ApplicationSummary,
  type CreateApplication,
  createApplicationSchema,
  ErrorCode,
  type GenerateCoverLetter,
  generateCoverLetterSchema,
  type MoveApplication,
  moveApplicationSchema,
  type UpdateApplication,
  updateApplicationSchema,
} from '@offerleap/shared';
import type { Response } from 'express';

import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { callAi } from '../ai/call-ai';
import { ApplicationsService } from './applications.service';

const ONE_HOUR = 60 * 60_000;

@ApiTags('applications')
@ApiCookieAuth('cookie')
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED, ErrorCode.ONBOARDING_REQUIRED)
@Controller('applications')
export class ApplicationsController {
  private readonly logger = new Logger(ApplicationsController.name);

  constructor(private readonly applications: ApplicationsService) {}

  @ApiOperation({ summary: 'Every application on the board' })
  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<ApplicationSummary[]> {
    return this.applications.list(user.sub);
  }

  @ApiOperation({ summary: 'Track a new application (optionally from an analysis)' })
  @ApiZodBody(createApplicationSchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED)
  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createApplicationSchema)) body: CreateApplication,
  ): Promise<ApplicationDetail> {
    return this.applications.create(user.sub, body);
  }

  @ApiOperation({ summary: 'One application with its job description, notes and cover letter' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @Get(':id')
  findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<ApplicationDetail> {
    return this.applications.findOwned(user.sub, id);
  }

  @ApiOperation({ summary: 'Edit some fields' })
  @ApiZodBody(updateApplicationSchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.COMMON_NOT_FOUND)
  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateApplicationSchema)) body: UpdateApplication,
  ): Promise<ApplicationDetail> {
    return this.applications.update(user.sub, id, body);
  }

  @ApiOperation({ summary: 'Move a card to another column / position' })
  @ApiZodBody(moveApplicationSchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.COMMON_NOT_FOUND)
  @Patch(':id/move')
  move(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moveApplicationSchema)) body: MoveApplication,
  ): Promise<ApplicationSummary> {
    return this.applications.move(user.sub, id, body);
  }

  @ApiOperation({ summary: 'Delete an application' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    return this.applications.remove(user.sub, id);
  }

  @ApiOperation({
    summary: 'Write a cover letter with AI (streamed)',
    description:
      'Streams plain text as the AI writes it. The finished letter is saved on the application. Errors before ' +
      'the first piece (no job description, AI unavailable) are normal JSON errors.',
  })
  @ApiZodBody(generateCoverLetterSchema)
  @ApiProduces('text/plain')
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.COMMON_NOT_FOUND, ErrorCode.AI_UNAVAILABLE)
  // Each letter costs an AI call.
  @Throttle({ default: { limit: 10, ttl: ONE_HOUR } })
  @Post(':id/cover-letter')
  async coverLetter(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(generateCoverLetterSchema)) body: GenerateCoverLetter,
    @Res() res: Response,
  ): Promise<void> {
    const stream = await callAi(() => this.applications.startCoverLetter(user.sub, id, body.locale));

    let closed = false;
    res.on('close', () => (closed = true));
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    // Proxies must pass the pieces through instead of buffering the whole answer.
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    let letter = '';
    try {
      for await (const piece of stream.chunks) {
        if (closed) return; // The user left: stop paying for tokens nobody reads.
        letter += piece;
        res.write(piece);
      }
      await this.applications.saveCoverLetter(user.sub, id, letter);
      const usage = stream.usage();
      this.logger.log(
        `Cover letter for ${id} by ${stream.model} (${usage.inputTokens}+${usage.outputTokens} tokens)`,
      );
      res.end();
    } catch (error) {
      // Headers are already sent, so a JSON error is impossible: cut the stream; the client sees it as incomplete.
      this.logger.warn(
        `Cover letter for ${id} failed mid-stream: ${error instanceof Error ? error.message : error}`,
      );
      res.destroy();
    }
  }
}
