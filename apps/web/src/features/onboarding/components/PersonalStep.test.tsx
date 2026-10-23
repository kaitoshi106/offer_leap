import type { ProfileValues } from '@offerleap/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { PersonalStep } from './PersonalStep';

const fetchMock = vi.fn<typeof fetch>();

const values: ProfileValues = {
  fullName: 'Trần Minh',
  phone: null,
  provinceCode: 'ha-noi',
  industryCode: 'software',
  jobTitle: 'Frontend Developer',
  level: 'SENIOR',
  yearsOfExperience: 5,
  skills: ['React'],
  expectedSalaryMin: null,
  expectedSalaryMax: null,
  workTypes: ['REMOTE'],
};

/** Answers API calls by method + path. */
function routes(handlers: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname.replace('/api/v1', '')}`;
    const handler = handlers[key];
    if (!handler) throw new Error(`Unexpected request ${key}`);
    return handler();
  });
}

describe('PersonalStep', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('says why saving failed when the problem is not one of its fields', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    routes({
      'GET /taxonomies/provinces': () =>
        jsonResponse(200, [{ code: 'ha-noi', nameVi: 'Hà Nội', nameEn: 'Hanoi', type: 'CITY' }]),
      'GET /taxonomies/industries': () => jsonResponse(200, []),
      'PUT /profile/sections': () =>
        jsonResponse(500, { statusCode: 500, code: 'COMMON_INTERNAL_ERROR', message: 'x' }),
    });
    renderWithProviders(<PersonalStep mode="profile" values={values} onSaved={onSaved} />);

    await user.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
