import { Injectable } from '@nestjs/common';
import {
  completeOnboardingSchema,
  ErrorCode,
  ONBOARDING_STEPS,
  type OnboardingState,
  type OnboardingStep,
  type SaveOnboardingStep,
  toFieldErrors,
  type UpdateProfileSection,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { toProfileValues } from '../profile/profile.mapper';
import { ResumesService } from '../resumes/resumes.service';
import { ProfileService } from '../profile/profile.service';

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
    private readonly profile: ProfileService,
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
    const current = await this.prisma.profile.findUnique({
      where: { userId },
      select: { onboardingStep: true },
    });
    const onboardingStep = Math.max(current?.onboardingStep ?? 1, STEP_NUMBER[input.step] + 1);

    if (input.step === 'resume') {
      // Nothing to store: the CV itself is saved by the resumes module.
      await this.prisma.profile.upsert({
        where: { userId },
        update: { onboardingStep },
        create: { userId, onboardingStep },
      });
    } else {
      // Same rules as the profile page; the resume point is written in the same transaction.
      await this.profile.saveSection(
        userId,
        { section: input.step, values: input.values } as UpdateProfileSection,
        {
          onboardingStep,
        },
      );
    }
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
}
