import type { ProfileValues } from '@offerleap/shared';

import type { Profile, User } from '../../generated/prisma/client';

/**
 * @description Combines the user's name with their (possibly missing or partial) profile row.
 * @param user - User row.
 * @param profile - Profile row, or `null` before the first save.
 */
export function toProfileValues(user: Pick<User, 'fullName'>, profile: Profile | null): ProfileValues {
  return {
    fullName: user.fullName,
    phone: profile?.phone ?? null,
    provinceCode: profile?.provinceCode ?? null,
    industryCode: profile?.industryCode ?? null,
    jobTitle: profile?.jobTitle ?? null,
    level: profile?.level ?? null,
    yearsOfExperience: profile?.yearsOfExperience ?? null,
    skills: profile?.skills ?? [],
    expectedSalaryMin: profile?.expectedSalaryMin ?? null,
    expectedSalaryMax: profile?.expectedSalaryMax ?? null,
    workTypes: profile?.workTypes ?? [],
  };
}
