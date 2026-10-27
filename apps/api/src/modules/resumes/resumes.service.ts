import { createHash, randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  RESUME_FILE_TYPES,
  RESUME_MAX_PER_USER,
  type ResumePreview,
  type ResumeSuggestions,
  type ResumeSummary,
  type UploadResumeFields,
} from '@offerleap/shared';
import type { Queue } from 'bullmq';
import { convertToHtml, extractRawText } from 'mammoth';

import { AppException } from '../../common/errors/app.exception';
import { isMissingReference } from '../../common/errors/prisma-errors';
import type { Prisma, Resume } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { enqueueAiJob } from '../ai/ai-job';
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

/** Stores uploaded CVs, queues them for AI parsing during onboarding and serves their status and files. */
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
   * @description Saves the file and, while onboarding is open, queues parsing: the AI's values only ever fill the
   * onboarding draft, so a CV uploaded afterwards is stored as UPLOADED without an AI call. Returns at once; the
   * client polls `findOwned` until the job finishes (an AI call takes several seconds — too long to hold the
   * request). The same file uploaded again returns the existing CV (`reused`) instead of a copy.
   * @param userId - Owner.
   * @param file - Upload from multer (already size-limited).
   * @param fields.replaceId - One of the user's CVs to delete (with its analyses) to make room, in the same
   * transaction as the new CV: it is kept if the upload fails, and not touched when the file is a duplicate.
   * @throws AppException COMMON_UNSUPPORTED_FILE_TYPE when the bytes aren't a PDF, DOCX, PNG, JPEG or WEBP.
   * @throws AppException RESUME_LIMIT_REACHED when the user already has RESUME_MAX_PER_USER CVs.
   * @throws AppException COMMON_NOT_FOUND when `replaceId` isn't one of the user's CVs (e.g. already deleted).
   */
  async upload(
    userId: string,
    file: UploadedResumeFile,
    { replaceId }: UploadResumeFields = {},
  ): Promise<ResumeSummary> {
    const mimeType = detectResumeType(file.buffer);
    if (!mimeType) {
      throw new AppException(ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE, { message: 'Not a supported CV file' });
    }
    const contentHash = createHash('sha256').update(file.buffer).digest('hex');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    });
    // A deleted account (its access token outlives it) isn't signed in.
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
    const parse = user.onboardingCompletedAt === null;

    // Early checks, before the file is stored; both are repeated under a lock below.
    const duplicate = await this.prisma.resume.findFirst({ where: { userId, contentHash } });
    if (duplicate) return this.reuse(duplicate, parse);
    if (!replaceId) await this.assertBelowLimit(userId);

    const storageKey = `resumes/${userId}/${randomUUID()}${RESUME_FILE_TYPES[mimeType]}`;
    await this.storage.put(storageKey, file.buffer);
    const saved = await this.prisma
      .$transaction(async (tx) => {
        // One upload at a time per user, so simultaneous uploads can't all pass the checks.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`resumes:${userId}`}))`;
        const existing = await tx.resume.findFirst({ where: { userId, contentHash } });
        if (existing) return { reused: true, resume: existing } as const;
        const replaced = replaceId ? await tx.resume.findFirst({ where: { id: replaceId, userId } }) : null;
        if (replaceId && !replaced) {
          throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Resume to replace not found' });
        }
        // Its analyses go with it (cascade), as with `remove`.
        if (replaced) {
          await tx.resume.delete({ where: { id: replaced.id } });
        } else {
          // A swap never adds a CV, so it needs no room — also for users who had more CVs before the limit.
          const count = await tx.resume.count({ where: { userId } });
          if (count >= RESUME_MAX_PER_USER) throw new AppException(ErrorCode.RESUME_LIMIT_REACHED);
        }
        const created = await tx.resume.create({
          data: {
            userId,
            fileName: file.originalname.slice(0, 255),
            mimeType,
            sizeBytes: file.buffer.length,
            storageKey,
            contentHash,
            status: parse ? 'PENDING' : 'UPLOADED',
          },
        });
        return { reused: false, resume: created, replaced } as const;
      })
      .catch(async (error: unknown) => {
        // No row for the file: don't keep it.
        await this.storage.remove(storageKey);
        if (isMissingReference(error)) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
        throw error;
      });

    if (saved.reused) {
      // The same file arrived twice at once: the other request stored it first.
      await this.storage.remove(storageKey);
      return this.reuse(saved.resume, parse);
    }
    if (saved.replaced) await this.storage.remove(saved.replaced.storageKey);
    if (parse) await this.queueParse(saved.resume.id);
    return toResumeSummary(saved.resume);
  }

  /**
   * @description Answers an upload of a file the user already has: that CV moves to the top (it is the one they
   * just picked; its date becomes this upload's). While onboarding is open it acts like a fresh upload: values
   * already read from it go back into the draft (another CV may have replaced them since, and no AI call is
   * needed), and a CV the AI failed to read is read again.
   * @param resume - The stored CV with the same content.
   * @param parse - Whether onboarding is open (the AI's values are still used).
   * @returns The CV, marked `reused`.
   */
  private async reuse(resume: Resume, parse: boolean): Promise<ResumeSummary> {
    const retry = parse && resume.status === 'FAILED';
    // Written only by the worker after validation, so the cast is safe.
    const suggestions = resume.suggestions as ResumeSuggestions | null;
    const refill = parse && resume.status === 'COMPLETED' && suggestions !== null;
    const [updated] = await this.prisma.$transaction([
      this.prisma.resume.update({
        where: { id: resume.id },
        data: { createdAt: new Date(), ...(retry && { status: 'PENDING', errorCode: null }) },
      }),
      ...(refill ? this.draftUpdates(resume.userId, suggestions) : []),
    ]);
    // A new job id: the earlier job keeps its id in Redis for a while (it may even still be finishing), and
    // queueing an existing id is a no-op.
    if (retry) await this.queueParse(resume.id, `${resume.id}-retry-${Date.now()}`);
    return { ...toResumeSummary(updated as Resume), reused: true };
  }

  /**
   * @description Early limit check, before the file is stored; `upload` checks again under a lock.
   * @param userId - Owner.
   * @throws AppException RESUME_LIMIT_REACHED
   */
  private async assertBelowLimit(userId: string): Promise<void> {
    const count = await this.prisma.resume.count({ where: { userId } });
    if (count >= RESUME_MAX_PER_USER) throw new AppException(ErrorCode.RESUME_LIMIT_REACHED);
  }

  /**
   * @description Queues the AI parse of a CV; if the queue can't be reached the CV is marked failed.
   * @param resumeId - CV to parse.
   * @param jobId - BullMQ job id; the CV id unless a parse is retried.
   */
  private queueParse(resumeId: string, jobId = resumeId): Promise<void> {
    return enqueueAiJob(this.queue, 'parse', { resumeId }, jobId, () =>
      this.markFailed(resumeId, ErrorCode.RESUME_PARSE_FAILED),
    );
  }

  /**
   * @description The stored file of one of the user's CVs, to show it back to them.
   * @param userId - Owner.
   * @param id - CV id.
   * @returns The bytes, with the type detected at upload and the name it was uploaded under.
   * @throws AppException COMMON_NOT_FOUND (also for someone else's CV).
   */
  async file(userId: string, id: string): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
    const resume = await this.prisma.resume.findFirst({ where: { id, userId } });
    if (!resume) throw new AppException(ErrorCode.COMMON_NOT_FOUND, { message: 'Resume not found' });
    return {
      data: await this.storage.get(resume.storageKey),
      mimeType: resume.mimeType,
      fileName: resume.fileName,
    };
  }

  /**
   * @description A DOCX as HTML, since browsers can't show Word files. The HTML comes from the user's own file;
   * the web app renders it in a sandboxed frame without scripts.
   * @param userId - Owner.
   * @param id - CV id.
   * @throws AppException COMMON_NOT_FOUND, or COMMON_UNSUPPORTED_FILE_TYPE for PDFs and images (shown as they are).
   */
  async preview(userId: string, id: string): Promise<ResumePreview> {
    const { data, mimeType } = await this.file(userId, id);
    if (mimeType !== DOCX) {
      throw new AppException(ErrorCode.COMMON_UNSUPPORTED_FILE_TYPE, {
        message: 'Only DOCX needs a preview',
      });
    }
    const { value } = await convertToHtml({ buffer: data });
    return { html: value };
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
