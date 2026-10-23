import { Injectable } from '@nestjs/common';
import {
  type AdminIndustry,
  type CreateIndustryInput,
  ErrorCode,
  type UpdateIndustryInput,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import { isUniqueViolation } from '../../common/errors/prisma-errors';
import type { Industry } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type IndustryRow = Industry & { _count: { profiles: number } };
const WITH_COUNT = { _count: { select: { profiles: true } } } as const;

const toAdminIndustry = ({ _count, ...industry }: IndustryRow): AdminIndustry => ({
  code: industry.code,
  nameVi: industry.nameVi,
  nameEn: industry.nameEn,
  sortOrder: industry.sortOrder,
  profileCount: _count.profiles,
});

/**
 * Industry taxonomy for admins. Codes are permanent (profiles store them, prompts list them); names can change.
 * Note: the public list is cached for an hour (`Cache-Control`), so users see changes within that time.
 */
@Injectable()
export class AdminIndustriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminIndustry[]> {
    const industries = await this.prisma.industry.findMany({
      include: WITH_COUNT,
      orderBy: { sortOrder: 'asc' },
    });
    return industries.map(toAdminIndustry);
  }

  /** Adds an industry at the end of the list. @throws AppException TAXONOMY_CODE_TAKEN. */
  async create(input: CreateIndustryInput): Promise<AdminIndustry> {
    if (await this.prisma.industry.findUnique({ where: { code: input.code } })) {
      throw new AppException(ErrorCode.TAXONOMY_CODE_TAKEN);
    }
    const last = await this.prisma.industry.aggregate({ _max: { sortOrder: true } });
    try {
      const industry = await this.prisma.industry.create({
        data: { ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 },
        include: WITH_COUNT,
      });
      return toAdminIndustry(industry);
    } catch (error) {
      // Added by another request in the meantime.
      if (isUniqueViolation(error)) throw new AppException(ErrorCode.TAXONOMY_CODE_TAKEN);
      throw error;
    }
  }

  /** @throws AppException COMMON_NOT_FOUND. */
  async update(code: string, input: UpdateIndustryInput): Promise<AdminIndustry> {
    const { count } = await this.prisma.industry.updateMany({ where: { code }, data: input });
    if (count === 0) throw new AppException(ErrorCode.COMMON_NOT_FOUND);
    return toAdminIndustry(
      await this.prisma.industry.findUniqueOrThrow({ where: { code }, include: WITH_COUNT }),
    );
  }

  /**
   * @description Deletes an industry no profile uses. In-use industries are refused rather than silently
   * clearing users' profiles.
   * @throws AppException COMMON_NOT_FOUND / TAXONOMY_IN_USE.
   */
  async remove(code: string): Promise<void> {
    const industry = await this.prisma.industry.findUnique({ where: { code }, include: WITH_COUNT });
    if (!industry) throw new AppException(ErrorCode.COMMON_NOT_FOUND);
    if (industry._count.profiles > 0) throw new AppException(ErrorCode.TAXONOMY_IN_USE);
    await this.prisma.industry.delete({ where: { code } });
  }
}
