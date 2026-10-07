import { ErrorCode, registerSchema } from '@offerleap/shared';
import { describe, expect, it } from 'vitest';

import { AppException } from '../errors/app.exception';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(registerSchema);

  it('returns the parsed (normalised) value', () => {
    expect(pipe.transform({ email: ' A@B.CO ', password: 'leap2026', fullName: 'Minh' })).toEqual({
      email: 'a@b.co',
      password: 'leap2026',
      fullName: 'Minh',
    });
  });

  it('throws COMMON_VALIDATION_FAILED with translatable field errors and limits', () => {
    let error: unknown;
    try {
      pipe.transform({ email: 'a@b.co', password: 'abc1', fullName: 'Minh' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).code).toBe(ErrorCode.COMMON_VALIDATION_FAILED);
    expect((error as AppException).status).toBe(422);
    expect((error as AppException).fieldErrors).toEqual([
      { field: 'password', rule: 'tooShort', params: { min: 8 } },
    ]);
  });
});
