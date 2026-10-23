import { Inject, Injectable } from '@nestjs/common';
import {
  type CreateInterview,
  ErrorCode,
  type InterviewDetail,
  type InterviewListItem,
  ValidationRule,
  type PageQuery,
  type Paginated,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import type { InterviewSession, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_PROVIDER, type AiProvider, type AiUsage } from '../ai/ai.types';
import { callAi } from '../ai/call-ai';
import {
  buildInterviewFeedbackParts,
  buildInterviewQuestionsParts,
  buildInterviewSummaryParts,
  INTERVIEW_FEEDBACK_TASK,
  INTERVIEW_QUESTIONS_TASK,
  INTERVIEW_SUMMARY_TASK,
  type InterviewContext,
  interviewFeedbackSchema,
  interviewFeedbackSystem,
  interviewQuestionsSchema,
  interviewQuestionsSystem,
  interviewSummarySchema,
  interviewSummarySystem,
} from '../ai/prompts/interview.v1';
import { INTERVIEW_INCLUDE, toInterviewDetail, toInterviewListItem } from './interview.mapper';

/** An AI call that started longer ago than this is assumed dead (the provider times out well before). */
const AI_CLAIM_TTL_MS = 2 * 60_000;

/**
 * @description `where` condition for "nobody is calling the AI for this row": never claimed, or claimed so long
 * ago that the request must have died (process restart) — so a crash can't lock a question forever.
 * @param field - The row's claim timestamp.
 */
function unclaimed<TField extends 'scoringStartedAt' | 'summaryStartedAt'>(field: TField) {
  return {
    OR: [{ [field]: null }, { [field]: { lt: new Date(Date.now() - AI_CLAIM_TTL_MS) } }],
  } as Record<'OR', Record<TField, Date | null | { lt: Date }>[]>;
}

/**
 * Mock interviews. Each step is one short AI call made inside the request (questions ~3 s, feedback ~2 s), so the
 * conversation feels direct; a busy provider surfaces as 503 and the user simply retries that step.
 */
@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  /**
   * @description Prepares the questions and stores the session. For a tracked application its job description
   * is used when none is given.
   * @throws AppException COMMON_VALIDATION_FAILED (unknown application), AI_UNAVAILABLE / AI_FAILED.
   */
  async create(userId: string, input: CreateInterview): Promise<InterviewDetail> {
    let jobDescription = input.jobDescription ?? null;
    if (input.applicationId) {
      const application = await this.prisma.jobApplication.findFirst({
        where: { id: input.applicationId, userId },
        select: { jobDescription: true },
      });
      if (!application) {
        throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
          message: 'Unknown application',
          fieldErrors: [{ field: 'applicationId', rule: ValidationRule.INVALID }],
        });
      }
      jobDescription ??= application.jobDescription;
    }

    const context = await this.context(userId, { ...input, jobDescription });
    const answer = await callAi(() =>
      this.ai.generateJson({
        userId,
        task: INTERVIEW_QUESTIONS_TASK,
        system: interviewQuestionsSystem(context, input.questionCount),
        parts: buildInterviewQuestionsParts(context),
        schema: interviewQuestionsSchema(input.questionCount),
      }),
    );

    const session = await this.prisma.interviewSession.create({
      data: {
        userId,
        applicationId: input.applicationId ?? null,
        jobTitle: input.jobTitle,
        jobDescription,
        type: input.type,
        locale: input.locale,
        aiModel: answer.model,
        inputTokens: answer.usage.inputTokens,
        outputTokens: answer.usage.outputTokens,
        questions: {
          create: answer.data.questions.map(({ question, focus }, index) => ({
            index,
            question: question.trim(),
            focus: focus.trim(),
          })),
        },
      },
      include: INTERVIEW_INCLUDE,
    });
    return toInterviewDetail(session);
  }

  /** One page of the user's interviews, newest first. */
  async list(userId: string, query: PageQuery): Promise<Paginated<InterviewListItem>> {
    const where = { userId };
    const [total, sessions] = await this.prisma.$transaction([
      this.prisma.interviewSession.count({ where }),
      this.prisma.interviewSession.findMany({
        where,
        include: INTERVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: sessions.map(toInterviewListItem), total, page: query.page, pageSize: query.pageSize };
  }

  /** @throws AppException COMMON_NOT_FOUND (also for someone else's id). */
  async findOwned(userId: string, id: string): Promise<InterviewDetail> {
    return toInterviewDetail(await this.findSession(userId, id));
  }

  /** @throws AppException COMMON_NOT_FOUND. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.interviewSession.deleteMany({ where: { id, userId } });
    if (count === 0) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Interview not found' });
  }

  /**
   * @description Scores one answer and returns the updated interview. Questions can be answered in any order,
   * but each only once.
   * @throws AppException COMMON_NOT_FOUND, INTERVIEW_ALREADY_COMPLETED, INTERVIEW_ALREADY_ANSWERED,
   *   AI_UNAVAILABLE / AI_FAILED.
   */
  async answer(userId: string, id: string, index: number, text: string): Promise<InterviewDetail> {
    const { session, question } = await this.openQuestion(userId, id, index);
    // Claim the question before calling the AI: a second request for it (another tab, a double submit) stops here
    // instead of paying for a second score that would be thrown away.
    const claimed = await this.prisma.interviewQuestion.updateMany({
      where: { id: question.id, answeredAt: null, ...unclaimed('scoringStartedAt') },
      data: { scoringStartedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new AppException(ErrorCode.INTERVIEW_ALREADY_ANSWERED, { message: 'Question is being answered' });
    }

    const context = await this.context(userId, session);
    const result = await callAi(() =>
      this.ai.generateJson({
        userId,
        task: INTERVIEW_FEEDBACK_TASK,
        system: interviewFeedbackSystem(context),
        parts: buildInterviewFeedbackParts(context, {
          question: question.question,
          focus: question.focus,
          answer: text,
        }),
        schema: interviewFeedbackSchema,
      }),
    ).catch(async (error: unknown) => {
      // Let the user retry.
      await this.prisma.interviewQuestion.update({
        where: { id: question.id },
        data: { scoringStartedAt: null },
      });
      throw error;
    });

    await this.saveAnswer(session.id, question.id, result.usage, {
      answer: text,
      score: result.data.score,
      feedback: result.data.feedback.trim(),
      betterAnswer: result.data.betterAnswer.trim(),
    });
    return this.findOwned(userId, id);
  }

  /** Marks a question as skipped (scored 0, no AI call). Same rules as {@link answer}. */
  async skip(userId: string, id: string, index: number): Promise<InterviewDetail> {
    const { session, question } = await this.openQuestion(userId, id, index);
    await this.saveAnswer(
      session.id,
      question.id,
      { inputTokens: 0, outputTokens: 0 },
      { skipped: true, score: 0 },
    );
    return this.findOwned(userId, id);
  }

  /**
   * @description Writes the final summary once every question is answered or skipped. Idempotent once done.
   * @throws AppException INTERVIEW_NOT_FINISHED, INTERVIEW_BUSY (another request is writing it),
   *   AI_UNAVAILABLE / AI_FAILED.
   */
  async complete(userId: string, id: string): Promise<InterviewDetail> {
    const session = await this.findSession(userId, id);
    if (session.status === 'COMPLETED') return toInterviewDetail(session);
    if (session.questions.some((question) => question.answeredAt === null)) {
      throw new AppException(ErrorCode.INTERVIEW_NOT_FINISHED, { message: 'Some questions are unanswered' });
    }

    // Same claim as for answers: only one request writes (and pays for) the summary.
    const claimed = await this.prisma.interviewSession.updateMany({
      where: { id: session.id, status: 'IN_PROGRESS', ...unclaimed('summaryStartedAt') },
      data: { summaryStartedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new AppException(ErrorCode.INTERVIEW_BUSY, { message: 'The summary is being written' });
    }

    const context = await this.context(userId, session);
    const result = await callAi(() =>
      this.ai.generateJson({
        userId,
        task: INTERVIEW_SUMMARY_TASK,
        system: interviewSummarySystem(context),
        parts: buildInterviewSummaryParts(context, session.questions),
        schema: interviewSummarySchema,
      }),
    ).catch(async (error: unknown) => {
      await this.prisma.interviewSession.update({
        where: { id: session.id },
        data: { summaryStartedAt: null },
      });
      throw error;
    });

    const summary = {
      overallScore: result.data.overallScore,
      summary: result.data.summary.trim(),
      strengths: result.data.strengths,
      improvements: result.data.improvements,
    };
    // Only the first completion wins if two requests race.
    await this.prisma.interviewSession.updateMany({
      where: { id: session.id, status: 'IN_PROGRESS' },
      data: {
        status: 'COMPLETED',
        overallScore: summary.overallScore,
        result: summary as Prisma.InputJsonObject,
        completedAt: new Date(),
        inputTokens: { increment: result.usage.inputTokens },
        outputTokens: { increment: result.usage.outputTokens },
      },
    });
    return this.findOwned(userId, id);
  }

  private async findSession(userId: string, id: string) {
    const session = await this.prisma.interviewSession.findFirst({
      where: { id, userId },
      include: INTERVIEW_INCLUDE,
    });
    if (!session) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Interview not found' });
    return session;
  }

  /** Session + question that may still be answered, or the reason it can't. */
  private async openQuestion(userId: string, id: string, index: number) {
    const session = await this.findSession(userId, id);
    if (session.status === 'COMPLETED') {
      throw new AppException(ErrorCode.INTERVIEW_ALREADY_COMPLETED, { message: 'Interview is completed' });
    }
    const question = session.questions.find((item) => item.index === index);
    if (!question) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Question not found' });
    if (question.answeredAt) {
      throw new AppException(ErrorCode.INTERVIEW_ALREADY_ANSWERED, { message: 'Question already answered' });
    }
    return { session, question };
  }

  /**
   * @description Stores an answer only if the question is still open — a double-submitted answer (two tabs,
   * double click) can't overwrite the first one.
   * @throws AppException INTERVIEW_ALREADY_ANSWERED when another request got there first.
   */
  private async saveAnswer(
    sessionId: string,
    questionId: string,
    usage: AiUsage,
    data: Omit<Prisma.InterviewQuestionUpdateManyMutationInput, 'answeredAt'>,
  ): Promise<void> {
    const [{ count }] = await this.prisma.$transaction([
      this.prisma.interviewQuestion.updateMany({
        where: { id: questionId, answeredAt: null },
        data: { ...data, answeredAt: new Date() },
      }),
      this.prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          inputTokens: { increment: usage.inputTokens },
          outputTokens: { increment: usage.outputTokens },
        },
      }),
    ]);
    if (count === 0) {
      throw new AppException(ErrorCode.INTERVIEW_ALREADY_ANSWERED, { message: 'Question already answered' });
    }
  }

  /** Prompt context: the job and what the profile says about the candidate. */
  private async context(
    userId: string,
    job: Pick<InterviewSession, 'locale' | 'type' | 'jobTitle' | 'jobDescription'>,
  ): Promise<InterviewContext> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    return {
      locale: job.locale,
      today: new Date(),
      type: job.type,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDescription,
      candidate: {
        jobTitle: profile?.jobTitle ?? null,
        level: profile?.level ?? null,
        yearsOfExperience: profile?.yearsOfExperience ?? null,
        skills: profile?.skills ?? [],
      },
    };
  }
}
