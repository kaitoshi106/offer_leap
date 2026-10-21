import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { LoginForm } from './LoginForm';

const redirect = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('@/lib/auth-redirect', () => ({ useAuthRedirect: () => redirect }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...rest }: ComponentProps<'a'>) => <a href={href} {...rest} />,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));

const fetchMock = vi.fn<typeof fetch>();
const session = {
  user: {
    id: 'u1',
    email: 'minh@example.com',
    fullName: 'Minh',
    role: 'USER',
    adminLevel: null,
    locale: 'vi',
    emailVerified: true,
    onboardingCompleted: true,
  },
  accessTokenExpiresAt: '2026-10-11T10:00:00.000Z',
};

/**
 * @description Fills and submits the login form.
 */
async function submit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^Email/), email);
  await user.type(screen.getByLabelText(/^Mật khẩu/), password);
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    searchParams = new URLSearchParams();
  });
  afterEach(() => {
    fetchMock.mockReset();
    redirect.mockReset();
    vi.unstubAllGlobals();
  });

  it('validates on the client with the shared schema before calling the API', async () => {
    renderWithProviders(<LoginForm />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findAllByText('Vui lòng nhập thông tin này.')).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.setup().type(screen.getByLabelText(/^Email/), 'not-an-email');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Email không hợp lệ.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in and goes to the requested page', async () => {
    searchParams = new URLSearchParams('next=/onboarding');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, session));
    renderWithProviders(<LoginForm />);

    await submit('Minh@Example.com', 'leap2026');

    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/onboarding'));
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      email: 'minh@example.com',
      password: 'leap2026',
    });
  });

  it('ignores an unsafe next parameter', async () => {
    searchParams = new URLSearchParams('next=https://evil.example');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, session));
    renderWithProviders(<LoginForm />);

    await submit('minh@example.com', 'leap2026');
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/dashboard'));
  });

  it('sends users who have not finished onboarding to the wizard', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ...session, user: { ...session.user, onboardingCompleted: false } }),
    );
    renderWithProviders(<LoginForm />);

    await submit('minh@example.com', 'leap2026');
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('/onboarding'));
  });

  it('shows the translated API error', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, code: 'AUTH_INVALID_CREDENTIALS', message: 'x' }),
    );
    renderWithProviders(<LoginForm />);

    await submit('minh@example.com', 'wrong123');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.');
  });

  it('offers to resend the verification email for unverified accounts', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { statusCode: 403, code: 'AUTH_EMAIL_NOT_VERIFIED', message: 'x' }),
    );
    renderWithProviders(<LoginForm />);

    await submit('minh@example.com', 'leap2026');
    expect(await screen.findByText(/Email chưa được xác thực/)).toHaveTextContent('minh@example.com');
    expect(screen.getByRole('button', { name: 'Gửi lại email' })).toBeEnabled();
  });

  it('confirms a deleted account after the redirect', () => {
    searchParams = new URLSearchParams('deleted=1');
    renderWithProviders(<LoginForm />);
    expect(screen.getByText(/Tài khoản của bạn đã được xoá/)).toBeInTheDocument();
    searchParams = new URLSearchParams();
  });
});
