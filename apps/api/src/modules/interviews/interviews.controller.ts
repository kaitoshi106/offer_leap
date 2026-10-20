import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AnswerQuestion,
  answerQuestionSchema,
  type CreateInterview,
  createInterviewSchema,
  ErrorCode,
  type InterviewDetail,
  type InterviewListItem,
} from '@offerleap/shared';

import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { InterviewsService } from './interviews.service';

const ONE_HOUR = 60 * 60_000;

@ApiTags('interviews')
@ApiCookieAuth('cookie')
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_TOKEN_EXPIRED, ErrorCode.ONBOARDING_REQUIRED)
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @ApiOperation({ summary: 'Start a mock interview (the AI writes the questions)' })
  @ApiZodBody(createInterviewSchema)
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED, ErrorCode.AI_UNAVAILABLE, ErrorCode.AI_FAILED)
  @Throttle({ default: { limit: 10, ttl: ONE_HOUR } })
  @Post()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createInterviewSchema)) body: CreateInterview,
  ): Promise<InterviewDetail> {
    return this.interviews.create(user.sub, body);
  }

  @ApiOperation({ summary: 'Your mock interviews, newest first' })
  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<InterviewListItem[]> {
    return this.interviews.list(user.sub);
  }

  @ApiOperation({ summary: 'Questions, answers, feedback and summary of one interview' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @Get(':id')
  findOne(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<InterviewDetail> {
    return this.interviews.findOwned(user.sub, id);
  }

  @ApiOperation({ summary: 'Answer a question and get feedback' })
  @ApiZodBody(answerQuestionSchema)
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.COMMON_NOT_FOUND,
    ErrorCode.INTERVIEW_ALREADY_ANSWERED,
    ErrorCode.INTERVIEW_ALREADY_COMPLETED,
    ErrorCode.AI_UNAVAILABLE,
    ErrorCode.AI_FAILED,
  )
  @Throttle({ default: { limit: 100, ttl: ONE_HOUR } })
  @HttpCode(HttpStatus.OK)
  @Post(':id/questions/:index/answer')
  answer(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
    @Body(new ZodValidationPipe(answerQuestionSchema)) body: AnswerQuestion,
  ): Promise<InterviewDetail> {
    return this.interviews.answer(user.sub, id, index, body.answer);
  }

  @ApiOperation({ summary: 'Skip a question (scored 0)' })
  @ApiErrors(
    ErrorCode.COMMON_NOT_FOUND,
    ErrorCode.INTERVIEW_ALREADY_ANSWERED,
    ErrorCode.INTERVIEW_ALREADY_COMPLETED,
  )
  @HttpCode(HttpStatus.OK)
  @Post(':id/questions/:index/skip')
  skip(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
  ): Promise<InterviewDetail> {
    return this.interviews.skip(user.sub, id, index);
  }

  @ApiOperation({ summary: 'Finish: the AI summarises every answer' })
  @ApiErrors(
    ErrorCode.COMMON_NOT_FOUND,
    ErrorCode.INTERVIEW_NOT_FINISHED,
    ErrorCode.AI_UNAVAILABLE,
    ErrorCode.AI_FAILED,
  )
  @Throttle({ default: { limit: 20, ttl: ONE_HOUR } })
  @HttpCode(HttpStatus.OK)
  @Post(':id/complete')
  complete(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<InterviewDetail> {
    return this.interviews.complete(user.sub, id);
  }

  @ApiOperation({ summary: 'Delete an interview' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    return this.interviews.remove(user.sub, id);
  }
}
