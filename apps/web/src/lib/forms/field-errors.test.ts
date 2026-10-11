import { registerSchema } from '@offerleap/shared';
import { describe, expect, it, vi } from 'vitest';

import { applyServerFieldErrors, sharedSchemaResolver } from './field-errors';

// The resolver ignores RHF's options; any value satisfies the signature in tests.
const options = {} as never;

describe('sharedSchemaResolver', () => {
  it('returns parsed values when valid', async () => {
    const resolver = sharedSchemaResolver(registerSchema);
    const result = await resolver(
      { email: ' A@B.CO ', password: 'leap2026', fullName: 'Minh' },
      undefined,
      options,
    );

    expect(result).toEqual({
      values: { email: 'a@b.co', password: 'leap2026', fullName: 'Minh' },
      errors: {},
    });
  });

  it('reports the first rule per field with params, like the API', async () => {
    const resolver = sharedSchemaResolver(registerSchema);
    const { errors } = await resolver({ email: 'x', password: 'abc', fullName: 'Minh' }, undefined, options);

    expect(errors).toEqual({
      email: { type: 'invalidEmail', message: JSON.stringify({ rule: 'invalidEmail' }) },
      password: { type: 'tooShort', message: JSON.stringify({ rule: 'tooShort', params: { min: 8 } }) },
    });
  });
});

describe('applyServerFieldErrors', () => {
  it('sets each API field error on the form', () => {
    const setError = vi.fn();
    const applied = applyServerFieldErrors([{ field: 'email', rule: 'invalidEmail' }], setError);

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledWith(
      'email',
      { type: 'invalidEmail', message: JSON.stringify({ rule: 'invalidEmail' }) },
      { shouldFocus: true },
    );
  });
});
