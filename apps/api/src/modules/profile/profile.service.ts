import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type FieldError,
  type ProfileValues,
  type UpdateProfileSection,
  ValidationRule,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TaxonomiesService } from '../taxonomies/taxonomies.service';
import { toProfileValues } from './profile.mapper';

/**
 * The career profile. Saving is done per section (personal, career, preferences) with the same rules everywhere:
 * the onboarding wizard and the profile page both call {@link saveSection}.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomies: TaxonomiesService,
  ) {}

  async get(userId: string): Promise<ProfileValues> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    return toProfileValues(user, user.profile);
  }

  /**
   * @description Saves one section; other sections stay as they are. The name lives on the user, the rest on the
   * profile — both written in one transaction.
   * @param userId - Owner.
   * @param input - Section and its validated values.
   * @param extra - Other profile columns to write in the same transaction (e.g. the onboarding resume point).
   * @throws AppException COMMON_VALIDATION_FAILED when a province/industry code doesn't exist.
   */
  async saveSection(
    userId: string,
    input: UpdateProfileSection,
    extra: Omit<Prisma.ProfileUncheckedCreateInput, 'userId'> = {},
  ): Promise<void> {
    await this.assertKnownCodes(input);
    const data = { ...this.sectionData(input), ...extra };
    await this.prisma.$transaction([
      ...(input.section === 'personal'
        ? [this.prisma.user.update({ where: { id: userId }, data: { fullName: input.values.fullName } })]
        : []),
      this.prisma.profile.upsert({ where: { userId }, update: data, create: { userId, ...data } }),
    ]);
  }

  private sectionData(input: UpdateProfileSection): Omit<Prisma.ProfileUncheckedCreateInput, 'userId'> {
    switch (input.section) {
      case 'personal':
        return { phone: input.values.phone || null, provinceCode: input.values.provinceCode };
      case 'career':
        return {
          industryCode: input.values.industryCode,
          jobTitle: input.values.jobTitle,
          level: input.values.level,
          yearsOfExperience: input.values.yearsOfExperience,
          skills: input.values.skills,
        };
      case 'preferences':
        return {
          expectedSalaryMin: input.values.expectedSalaryMin ?? null,
          expectedSalaryMax: input.values.expectedSalaryMax ?? null,
          workTypes: input.values.workTypes,
        };
    }
  }

  /** Zod knows a code is a string, not that it exists: check against the taxonomies (else the FK would 500). */
  private async assertKnownCodes(input: UpdateProfileSection): Promise<void> {
    const found = await this.taxonomies.exists({
      provinceCode: input.section === 'personal' ? input.values.provinceCode : undefined,
      industryCode: input.section === 'career' ? input.values.industryCode : undefined,
    });
    const fieldErrors: FieldError[] = [];
    if (!found.province) fieldErrors.push({ field: 'provinceCode', rule: ValidationRule.INVALID });
    if (!found.industry) fieldErrors.push({ field: 'industryCode', rule: ValidationRule.INVALID });
    if (fieldErrors.length > 0) {
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
        message: 'Unknown taxonomy code',
        fieldErrors,
      });
    }
  }
}
