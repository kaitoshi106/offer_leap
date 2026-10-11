import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { RegisterForm } from './RegisterForm';

const fetchMock = vi.fn<typeof fetch>();

/**
 * @description Fills and submits the registration form.
 */
async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Họ và tên/), 'Trần Minh');
  await user.type(screen.getByLabelText(/^Email/), 'minh@example.com');
  await user.type(screen.getByLabelText(/^Mật khẩu/), 'leap2026');
  await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
}

describe('RegisterForm', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends the current locale and shows the check-your-inbox panel', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { email: 'minh@example.com' }));
    renderWithProviders(<RegisterForm />);

    await fillAndSubmit();

    expect(await screen.findByText('Kiểm tra hộp thư của bạn')).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({ locale: 'vi' });
    // An email was just sent, so resending starts on cooldown.
    expect(screen.getByRole('button', { name: /Gửi lại sau \d+s/ })).toBeDisabled();
  });

  it('puts API field errors on the matching inputs', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        statusCode: 422,
        code: 'COMMON_VALIDATION_FAILED',
        message: 'x',
        fieldErrors: [{ field: 'password', rule: 'tooShort', params: { min: 12 } }],
      }),
    );
    renderWithProviders(<RegisterForm />);

    await fillAndSubmit();

    expect(await screen.findByLabelText(/^Mật khẩu/)).toHaveAccessibleDescription('Cần ít nhất 12 ký tự.');
  });

  it('shows non-field errors as an alert', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { statusCode: 409, code: 'AUTH_EMAIL_TAKEN', message: 'x' }),
    );
    renderWithProviders(<RegisterForm />);

    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email này đã được sử dụng.');
  });
});
