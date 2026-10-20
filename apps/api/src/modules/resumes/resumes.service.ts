import { randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode, RESUME_FILE_TYPES, type ResumeSuggestions, type ResumeSummary } from '@offerleap/shared';
import type { Queue } from 'bullmq';
import { extractRawText } from 'mammoth';

import { AppException } from '../../common/errors/app.exception';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AI_JOB_OPTIONS } from '../ai/ai-job';
import { AiInvalidOutputError } from '../ai/ai.errors';
import { AI_PROVIDER, type AiProvider } from '../ai/ai.types';
import {
  buildResumeExtractionParts,
  RESUME_EXTRACTION_TASK,
  type ResumeDocument,
  resumeExtractionSchema,
  resumeExtractionSystem,
} from '../ai/prompts/resume-extraction.v2';
import { TaxonomiesService } from '../taxonomies/taxonomies.service';
import { detectResumeType } from './resume-file';
import { toResumeSuggestions } from './resume-suggestions';
import { toResumeSummary } from './resume.mapper';
import { RESUME_QUEUE, type ResumeJob } from './resumes.types';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface UploadedResumeFile {
  originalname: string;
  buffer: Buffer;
}

/** Stores uploaded CVs, queues them for AI parsing and serves their status. */
@Injectable()
export class ResumesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly taxonomies: TaxonomiesService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @InjectQueue(RESUME_QUEUE) private readonly queue: Queue<ResumeJob>,
  ) {}

  /**
   * @description Saves the file and queues parsing. Returns at once with status PENDING; the client polls
   * `findOwned` until the job finishes (an AI call takes several seconds — too long to hold the request).
   * @param userId - Owner.
   * @param file - Upload from multer (already size-limited).
   * @throws AppException COMMON_UNSUPPORTED_FILE_TYPE when the bytes aren't a PDF, DOCX, PNG, JPEG or WEBP.
   */
  async upload(userId: string, file: UploadedResumeFile): Promise<ResumeSummary> {
    const mimeType = detectResumeType(file.buffer);
    if (!mimeType) {
      throw new AppException(ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE, { message: 'Not a supported CV file' });
    }

    const storageKey = `resumes/${userId}/${randomUUID()}${RESUME_FILE_TYPES[mimeType]}`;
    await this.storage.put(storageKey, file.buffer);
    const resume = await this.prisma.resume.create({
      data: {
        userId,
        fileName: file.originalname.slice(0, 255),
        mimeType,
        sizeBytes: file.buffer.length,
        storageKey,
      },
    });

    await this.queue.add(
      'parse',
      { resumeId: resume.id },
      {
        // Same id as the row: queueing the same CV twice is a no-op.
        jobId: resume.id,
        ...AI_JOB_OPTIONS,
      },
    );
    return toResumeSummary(resume);
  }

  /**
   * @description One of the user's CVs. Another user's id gives the same 404 as a missing one, so ids can't be
   * probed.
   * @throws AppException COMMON_NOT_FOUND.
   */
  async findOwned(userId: string, id: string): Promise<ResumeSummary> {
    const resume = await this.prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Resume not found' });
    return toResumeSummary(resume);
  }

  /** The user's CVs, newest first (to pick one for a job analysis). */
  async list(userId: string): Promise<ResumeSummary[]> {
    const resumes = await this.prisma.resume.findMany({
      where: { userId },
      include: { _count: { select: { analyses: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return resumes.map((resume) => ({ ...toResumeSummary(resume), analysisCount: resume._count.analyses }));
  }

  /**
   * @description Deletes a CV, its file and the analyses made with it (they can't be re-run without the CV);
   * applications created from those analyses stay, just unlinked. Profile values filled from the CV stay too —
   * they belong to the user now.
   * @throws AppException COMMON_NOT_FOUND (also for someone else's CV).
   */
  async remove(userId: string, id: string): Promise<void> {
    const resume = await this.prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Resume not found' });
    await this.prisma.resume.delete({ where: { id } });
    await this.storage.remove(resume.storageKey);
  }

  /** The user's most recent upload, or null. */
  async latest(userId: string): Promise<ResumeSummary | null> {
    const resume = await this.prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return resume && toResumeSummary(resume);
  }

  /**
   * @description Worker step: reads the file, asks the AI for profile fields, stores the cleaned suggestions and —
   * while onboarding is still open — writes every value the AI found into the profile draft, replacing what was
   * there. Both happen in one transaction, so the client never sees COMPLETED with the old draft.
   * @param resumeId - Row to parse. Missing or finished rows are skipped (jobs can be delivered twice).
   * @throws AiUnavailableError (retry later) or AiInvalidOutputError (give up).
   */
  async parse(resumeId: string): Promise<void> {
    const resume = await this.prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume || resume.status === 'COMPLETED') return;
    await this.prisma.resume.update({ where: { id: resumeId }, data: { status: 'PROCESSING' } });

    const document = await this.loadDocument(resume);
    const [industries, provinces] = await Promise.all([
      this.taxonomies.industries(),
      this.taxonomies.provinces(),
    ]);
    const context = { industries, provinces };

    const result = await this.ai.generateJson({
      userId: resume.userId,
      task: RESUME_EXTRACTION_TASK,
      system: resumeExtractionSystem(new Date()),
      parts: buildResumeExtractionParts(document, context),
      schema: resumeExtractionSchema(context),
    });

    const suggestions = toResumeSuggestions(result.data);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: resume.userId },
      select: { onboardingCompletedAt: true },
    });
    const applyToDraft = user.onboardingCompletedAt === null;

    await this.prisma.$transaction([
      ...(applyToDraft ? this.draftUpdates(resume.userId, suggestions) : []),
      this.prisma.resume.update({
        where: { id: resumeId },
        data: {
          status: 'COMPLETED',
          suggestions: { ...suggestions },
          errorCode: null,
          aiModel: result.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          processedAt: new Date(),
        },
      }),
    ]);
  }

  /**
   * @description Writes the values the AI found over the onboarding draft. Fields it couldn't read (null / no
   * skills) keep their current value. Later edits by the user are saved normally and win from then on.
   * @param userId - Owner of the CV.
   * @param suggestions - Cleaned, validated suggestions.
   */
  private draftUpdates(userId: string, suggestions: ResumeSuggestions): Prisma.PrismaPromise<unknown>[] {
    const { fullName, uncertainFields: _uncertain, skills, ...fields } = suggestions;
    const profile: Omit<Prisma.ProfileUncheckedCreateInput, 'userId'> = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== null),
    );
    if (skills.length > 0) profile.skills = skills;

    return [
      ...(fullName ? [this.prisma.user.update({ where: { id: userId }, data: { fullName } })] : []),
      this.prisma.profile.upsert({ where: { userId }, update: profile, create: { userId, ...profile } }),
    ];
  }

  async markFailed(resumeId: string, errorCode: ErrorCode): Promise<void> {
    await this.prisma.resume.updateMany({
      where: { id: resumeId },
      data: { status: 'FAILED', errorCode, processedAt: new Date() },
    });
  }

  /**
   * @description PDFs and images go to the model as files. DOCX isn't a format Gemini reads natively, so its
   * text is extracted locally with mammoth (layout is lost, the words are what matter).
   * @param resume - Stored file location and its detected type.
   * @throws AiInvalidOutputError when a DOCX has no readable text.
   */
  async loadDocument({
    storageKey,
    mimeType,
  }: {
    storageKey: string;
    mimeType: string;
  }): Promise<ResumeDocument> {
    const data = await this.storage.get(storageKey);
    if (mimeType !== DOCX) return { type: 'file', mimeType, data };

    const { value } = await extractRawText({ buffer: data });
    const text = value.trim();
    if (!text) throw new AiInvalidOutputError('The document has no text');
    return { type: 'text', text };
  }
}
