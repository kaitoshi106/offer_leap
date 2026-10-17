import { Injectable } from '@nestjs/common';
import type { ProvinceItem, TaxonomyItem } from '@offerleap/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaxonomiesService {
  constructor(private readonly prisma: PrismaService) {}

  industries(): Promise<TaxonomyItem[]> {
    return this.prisma.industry.findMany({
      select: { code: true, nameVi: true, nameEn: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  provinces(): Promise<ProvinceItem[]> {
    return this.prisma.province.findMany({
      select: { code: true, nameVi: true, nameEn: true, type: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * @description Which of the given codes exist, for validating user input against the taxonomies.
   * @param codes - Industry and province codes to check.
   */
  async exists(codes: {
    industryCode?: string;
    provinceCode?: string;
  }): Promise<{ industry: boolean; province: boolean }> {
    const [industry, province] = await Promise.all([
      codes.industryCode ? this.prisma.industry.count({ where: { code: codes.industryCode } }) : 1,
      codes.provinceCode ? this.prisma.province.count({ where: { code: codes.provinceCode } }) : 1,
    ]);
    return { industry: industry > 0, province: province > 0 };
  }
}
