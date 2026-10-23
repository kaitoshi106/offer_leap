import { ErrorCode } from '@offerleap/shared';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service';
import { STUCK_AFTER_MS, StuckJobsSweeper } from './stuck-jobs.sweeper';

function fakePrisma() {
  const model = () => ({ updateMany: vi.fn().mockResolvedValue({ count: 1 }) });
  return { resume: model(), jobAnalysis: model(), knowledgeDocument: model() };
}

describe('StuckJobsSweeper', () => {
  it('fails CVs, analyses and documents that have been waiting far longer than any job takes', async () => {
    const prisma = fakePrisma();
    const now = new Date('2026-10-22T10:00:00.000Z');
    const sweeper = new StuckJobsSweeper(prisma as unknown as PrismaService);

    const failed = await sweeper.sweep(now);

    const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);
    const where = { status: { in: ['PENDING', 'PROCESSING'] }, updatedAt: { lt: cutoff } };
    expect(prisma.resume.updateMany).toHaveBeenCalledWith({
      where,
      data: { status: 'FAILED', errorCode: ErrorCode.RESUME_PARSE_FAILED, processedAt: now },
    });
    expect(prisma.jobAnalysis.updateMany).toHaveBeenCalledWith({
      where,
      data: { status: 'FAILED', errorCode: ErrorCode.ANALYSIS_FAILED, processedAt: now },
    });
    expect(prisma.knowledgeDocument.updateMany).toHaveBeenCalledWith({
      where,
      data: { status: 'FAILED', errorCode: ErrorCode.KNOWLEDGE_PROCESSING_FAILED, processedAt: now },
    });
    expect(failed).toBe(3);
    // Longer than the slowest job: 3 attempts with backoff, each bounded by the provider's timeout.
    expect(STUCK_AFTER_MS).toBeGreaterThanOrEqual(10 * 60_000);
  });
});
