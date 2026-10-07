import { ValidationRule } from '@offerleap/shared';
import { describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import vi from '../../messages/vi.json';

describe('validation messages', () => {
  it.each(Object.values(ValidationRule))('translates rule %s in every locale', (rule) => {
    expect(vi.validation).toHaveProperty(rule);
    expect(en.validation).toHaveProperty(rule);
  });
});
