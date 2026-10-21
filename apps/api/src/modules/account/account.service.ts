import { Injectable, Logger } from '@nestjs/common';
import {
  ACCOUNT_EXPORT_VERSION,
  type AccountExport,
  canDeleteOwnAccount,
  type DeleteAccountInput,
  ErrorCode,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import { verifyPassword } from '../../common/security/hashing';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ANALYSIS_INCLUDE, toAnalysisDetail } from '../analyses/analysis.mapper';
import { APPLICATION_INCLUDE, toApplicationDetail } from '../applications/application.mapper';
import { INTERVIEW_INCLUDE, toInterviewDetail } from '../interviews/interview.mapper';
import { toKnowledgeDocument } from '../knowledge/knowledge.mapper';
import { toProfileValues } from '../profile/profile.mapper';
import { toResumeSummary } from '../resumes/resume.mapper';
import { toAuthUser } from '../users/users.service';

/** The user's own data: download all of it, or delete the account with it. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * @description Everything the user created, in the shapes the API already returns (so no internal field —
   * password hash, tokens, storage keys, embeddings — can leak through a new mapper).
   * @throws AppException AUTH_UNAUTHENTICATED when the account no longer exists.
   */
  async export(userId: string): Promise<AccountExport> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
    const newestFirst = { orderBy: { createdAt: 'desc' } } as const;
    const [resumes, analyses, applications, interviews, documents] = await Promise.all([
      this.prisma.resume.findMany({ where: { userId }, ...newestFirst }),
      this.prisma.jobAnalysis.findMany({ where: { userId }, include: ANALYSIS_INCLUDE, ...newestFirst }),
      this.prisma.jobApplication.findMany({
        where: { userId },
        include: APPLICATION_INCLUDE,
        ...newestFirst,
      }),
      this.prisma.interviewSession.findMany({
        where: { userId },
        include: INTERVIEW_INCLUDE,
        ...newestFirst,
      }),
      this.prisma.knowledgeDocument.findMany({
        where: { userId },
        include: { chunks: { select: { content: true }, orderBy: { index: 'asc' } } },
        ...newestFirst,
      }),
    ]);

    return {
      version: ACCOUNT_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      account: { ...toAuthUser(user), createdAt: user.createdAt.toISOString() },
      profile: user.role === 'USER' ? toProfileValues(user, user.profile) : null,
      resumes: resumes.map(toResumeSummary),
      analyses: analyses.map(toAnalysisDetail),
      applications: applications.map(toApplicationDetail),
      interviews: interviews.map(toInterviewDetail),
      documents: documents.map((document) => ({
        ...toKnowledgeDocument(document),
        passages: document.chunks.map((chunk) => chunk.content),
      })),
    };
  }

  /**
   * @description Deletes the account and everything it owns: rows go by cascade in one statement, then the
   * uploaded files. AI usage logs stay for cost statistics, without the user (`SetNull`).
   * @throws AppException AUTH_ACCOUNT_DELETE_NOT_ALLOWED (root), AUTH_INVALID_CREDENTIALS (wrong password).
   */
  async delete(userId: string, input: DeleteAccountInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(ErrorCode.AUTH_UNAUTHENTICATED);
    if (!canDeleteOwnAccount(user)) throw new AppException(ErrorCode.AUTH_ACCOUNT_DELETE_NOT_ALLOWED);
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw new AppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const [resumes, documents] = await Promise.all([
      this.prisma.resume.findMany({ where: { userId }, select: { storageKey: true } }),
      this.prisma.knowledgeDocument.findMany({ where: { userId }, select: { storageKey: true } }),
    ]);
    await this.prisma.user.delete({ where: { id: userId } });

    // Files last: a failed row delete must not leave rows pointing at missing files. A file that can't be removed
    // is only logged — the account is already gone and nothing references the file any more.
    const keys = [...resumes, ...documents].flatMap(({ storageKey }) => (storageKey ? [storageKey] : []));
    const results = await Promise.allSettled(keys.map((key) => this.storage.remove(key)));
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) this.logger.warn(`Account ${userId} deleted; ${failed} file(s) could not be removed`);
  }
}
