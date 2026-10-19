import { Injectable } from '@nestjs/common';
import {
  completeOnboardingSchema,
  ErrorCode,
  type FieldError,
  ONBOARDING_STEPS,
  type OnboardingState,
  type OnboardingStep,
  type SaveOnboardingStep,
  toFieldErrors,
  ValidationRule,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toProfileValues } from '../profile/profile.mapper';
import { ResumesService } from '../resumes/resumes.service';
import { TaxonomiesService } from '../taxonomies/taxonomies.service';

/** 1-based position of each step, as stored in `Profile.onboardingStep`. */
const STEP_NUMBER = Object.fromEntries(ONBOARDING_STEPS.map((step, index) => [step, index + 1])) as Record<
  OnboardingStep,
  number
>;

/**
 * @description Maps a stored step number back to its name (out-of-range values resume at the first step).
 * @param stepNumber - `Profile.onboardingStep`.
 */
function stepName(stepNumber: number): OnboardingStep {
  return ONBOARDING_STEPS[stepNumber - 1] ?? ONBOARDING_STEPS[0];
}

/** Saves the onboarding wizard step by step and marks the profile complete once every required field is valid. */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomies: TaxonomiesService,
    private readonly resumes: ResumesService,
  ) {}

  /**
   * @description Current draft and the step to resume at.
   * @param userId - Signed-in user.
   */
  async getState(userId: string): Promise<OnboardingState> {
    const [user, resume] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } }),
      this.resumes.latest(userId),
    ]);
    return {
      step: stepName(user.profile?.onboardingStep ?? 1),
      completed: user.onboardingCompletedAt !== null,
      values: toProfileValues(user, user.profile),
      resume,
    };
  }

  /**
   * @description Saves one step. Only that step's fields change; the resume point moves forward (never back, so
   * revisiting an earlier step doesn't lose progress).
   * @param userId - Signed-in user.
   * @param input - Step name and its validated values.
   * @returns The updated state.
   * @throws AppException COMMON_VALIDATION_FAILED when a province/industry code doesn't exist.
   */
  async saveStep(userId: string, input: SaveOnboardingStep): Promise<OnboardingState> {
    await this.assertKnownCodes(input);

    const current = await this.prisma.profile.findUnique({
      where: { userId },
      select: { onboardingStep: true },
    });
    const onboardingStep = Math.max(current?.onboardingStep ?? 1, STEP_NUMBER[input.step] + 1);
    const data = { ...this.profileData(input), onboardingStep };

    await this.prisma.$transaction([
      ...(input.step === 'personal'
        ? [this.prisma.user.update({ where: { id: userId }, data: { fullName: input.values.fullName } })]
        : []),
      this.prisma.profile.upsert({ where: { userId }, update: data, create: { userId, ...data } }),
    ]);
    return this.getState(userId);
  }

  /**
   * @description Validates the saved draft as a whole and marks onboarding complete. Idempotent.
   * @param userId - Signed-in user.
   * @throws AppException COMMON_VALIDATION_FAILED listing every missing/invalid field (the client uses the field
   *   names to jump back to the right step).
   */
  async complete(userId: string): Promise<OnboardingState> {
    const state = await this.getState(userId);
    if (state.completed) return state;

    const { values } = state;
    const result = completeOnboardingSchema.safeParse({ ...values, phone: values.phone ?? '' });
    if (!result.success) {
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED, {
        message: 'Onboarding is incomplete',
        fieldErrors: toFieldErrors(result.error.issues),
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } }),
      this.prisma.profile.update({ where: { userId }, data: { onboardingStep: STEP_NUMBER.review } }),
    ]);
    return { ...state, step: 'review', completed: true };
  }

  private profileData(input: SaveOnboardingStep): Omit<Prisma.ProfileUncheckedCreateInput, 'userId'> {
    switch (input.step) {
      // Nothing to store: the CV itself is saved by the resumes module.
      case 'resume':
        return {};
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

  private async assertKnownCodes(input: SaveOnboardingStep): Promise<void> {
    const codes = {
      provinceCode: input.step === 'personal' ? input.values.provinceCode : undefined,
      industryCode: input.step === 'career' ? input.values.industryCode : undefined,
    };
    const found = await this.taxonomies.exists(codes);
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
