import { Inject, Injectable } from '@nestjs/common';
import {
  type ApplicationDetail,
  type ApplicationSummary,
  type CreateApplication,
  ErrorCode,
  JOB_DESCRIPTION_LIMITS,
  type Locale,
  type MoveApplication,
  type UpdateApplication,
  ValidationRule,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_PROVIDER, type AiProvider, type AiTextStream } from '../ai/ai.types';
import { buildCoverLetterParts, COVER_LETTER_TASK, coverLetterSystem } from '../ai/prompts/cover-letter.v2';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ResumesService } from '../resumes/resumes.service';
import { APPLICATION_INCLUDE, toApplicationDetail, toApplicationSummary } from './application.mapper';

/** Job applications on the kanban board, and their AI-written cover letters. */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resumes: ResumesService,
    private readonly knowledge: KnowledgeService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  /** Every card, grouped by column order then position (the client splits them into columns). */
  async list(userId: string): Promise<ApplicationSummary[]> {
    const applications = await this.prisma.jobApplication.findMany({
      where: { userId },
      include: APPLICATION_INCLUDE,
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
    });
    return applications.map(toApplicationSummary);
  }

  /**
   * @description Adds a card at the top of its column. From an analysis, the job description is copied over.
   * @throws AppException COMMON_VALIDATION_FAILED when the analysis isn't the user's.
   */
  async create(userId: string, input: CreateApplication): Promise<ApplicationDetail> {
    let jobDescription = input.jobDescription ?? null;
    if (input.analysisId) {
      const analysis = await this.prisma.jobAnalysis.findFirst({
        where: { id: input.analysisId, userId },
        select: { jobDescription: true },
      });
      if (!analysis) throw this.invalid('analysisId');
      jobDescription ??= analysis.jobDescription;
    }

    const top = await this.prisma.jobApplication.findFirst({
      where: { userId, status: input.status },
      orderBy: { position: 'asc' },
      select: { position: true },
    });
    const application = await this.prisma.jobApplication.create({
      data: {
        userId,
        company: input.company,
        jobTitle: input.jobTitle,
        jobUrl: input.jobUrl ?? null,
        jobDescription,
        status: input.status,
        position: (top?.position ?? 1) - 1,
        analysisId: input.analysisId ?? null,
      },
      include: APPLICATION_INCLUDE,
    });
    return toApplicationDetail(application);
  }

  /** @throws AppException COMMON_NOT_FOUND (also for someone else's id). */
  async findOwned(userId: string, id: string): Promise<ApplicationDetail> {
    return toApplicationDetail(await this.findRow(userId, id));
  }

  /** @throws AppException COMMON_NOT_FOUND. */
  async update(userId: string, id: string, input: UpdateApplication): Promise<ApplicationDetail> {
    await this.findRow(userId, id);
    const application = await this.prisma.jobApplication.update({
      where: { id },
      data: input,
      include: APPLICATION_INCLUDE,
    });
    return toApplicationDetail(application);
  }

  /**
   * @description Moves a card to a column and position (the client computes the position from its neighbours).
   * @throws AppException COMMON_NOT_FOUND.
   */
  async move(userId: string, id: string, input: MoveApplication): Promise<ApplicationSummary> {
    await this.findRow(userId, id);
    const application = await this.prisma.jobApplication.update({
      where: { id },
      data: { status: input.status, position: input.position },
      include: APPLICATION_INCLUDE,
    });
    return toApplicationSummary(application);
  }

  /** @throws AppException COMMON_NOT_FOUND. */
  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.jobApplication.deleteMany({ where: { id, userId } });
    if (count === 0) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Application not found' });
  }

  /**
   * @description Starts writing a cover letter. Everything that can fail with a proper error response (missing
   * job description, no AI model available) happens before the first piece arrives, while the client still
   * gets a JSON error.
   * @param userId - Owner.
   * @param id - Application.
   * @param locale - Language of the letter.
   * @throws AppException COMMON_NOT_FOUND / COMMON_VALIDATION_FAILED (job description missing or too short).
   * @throws AiUnavailableError when no model can start answering.
   */
  async startCoverLetter(userId: string, id: string, locale: Locale): Promise<AiTextStream> {
    const application = await this.findRow(userId, id);
    if ((application.jobDescription?.length ?? 0) < JOB_DESCRIPTION_LIMITS.min)
      throw this.invalid('jobDescription');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    // The CV of the linked analysis is the one the user chose for this job; otherwise the latest upload.
    const resume = await this.prisma.resume.findFirst({
      where: application.analysisId ? { analyses: { some: { id: application.analysisId } } } : { userId },
      orderBy: { createdAt: 'desc' },
      select: { storageKey: true, mimeType: true },
    });

    const context = {
      locale,
      today: new Date(),
      candidate: {
        fullName: user.fullName,
        jobTitle: user.profile?.jobTitle ?? null,
        yearsOfExperience: user.profile?.yearsOfExperience ?? null,
        skills: user.profile?.skills ?? [],
      },
      job: {
        company: application.company,
        jobTitle: application.jobTitle,
        jobDescription: application.jobDescription!,
      },
      resume: resume && (await this.resumes.loadDocument(resume).catch(() => null)),
      // RAG: the user's own passages closest to this job, for concrete achievements.
      notes: await this.knowledge.search(userId, application.jobDescription!, {
        limit: 4,
        relevantOnly: true,
      }),
    };
    return this.ai.streamText({
      userId,
      task: COVER_LETTER_TASK,
      system: coverLetterSystem(context),
      parts: buildCoverLetterParts(context),
      maxOutputTokens: 2048,
    });
  }

  /** Stores a finished letter (only complete letters are saved; the user can still edit it afterwards). */
  async saveCoverLetter(userId: string, id: string, coverLetter: string): Promise<void> {
    await this.prisma.jobApplication.updateMany({
      where: { id, userId },
      data: { coverLetter: coverLetter.trim() },
    });
  }

  private async findRow(userId: string, id: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: { id, userId },
      include: APPLICATION_INCLUDE,
    });
    if (!application)
      throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Application not found' });
    return application;
  }

  private invalid(field: string): AppException {
    return new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
      message: `Invalid ${field}`,
      fieldErrors: [
        { field, rule: field === 'jobDescription' ? ValidationRule.REQUIRED : ValidationRule.INVALID },
      ],
    });
  }
}
