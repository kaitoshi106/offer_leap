import type {
  AcceptInvitationInput,
  AuthProviders,
  SignInMethods,
  InvitationPreview,
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  EmailOnlyInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@offerleap/shared';

import { apiRequest } from '@/lib/api/client';

/** Auth endpoints never retry through a refresh: a 401 there is the answer, not an expired session. */
const PUBLIC = { refreshOnUnauthorized: false } as const;

export const authApi = {
  register: (body: RegisterInput) =>
    apiRequest<{ email: string }>('/auth/register', { method: 'POST', body, ...PUBLIC }),
  verifyEmail: (token: string) =>
    apiRequest<AuthSession>('/auth/verify-email', { method: 'POST', body: { token }, ...PUBLIC }),
  resendVerification: (body: EmailOnlyInput) =>
    apiRequest<void>('/auth/resend-verification', { method: 'POST', body, ...PUBLIC }),
  login: (body: LoginInput) => apiRequest<AuthSession>('/auth/login', { method: 'POST', body, ...PUBLIC }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', ...PUBLIC }),
  me: (signal?: AbortSignal) => apiRequest<AuthUser>('/auth/me', { signal }),
  forgotPassword: (body: EmailOnlyInput) =>
    apiRequest<void>('/auth/forgot-password', { method: 'POST', body, ...PUBLIC }),
  resetPassword: (body: ResetPasswordInput) =>
    apiRequest<void>('/auth/reset-password', { method: 'POST', body, ...PUBLIC }),
  previewInvitation: (token: string) =>
    apiRequest<InvitationPreview>('/auth/admin-invitations/preview', {
      method: 'POST',
      body: { token },
      ...PUBLIC,
    }),
  acceptInvitation: (body: AcceptInvitationInput) =>
    apiRequest<AuthSession>('/auth/accept-invitation', { method: 'POST', body, ...PUBLIC }),
  changePassword: (body: ChangePasswordInput) =>
    apiRequest<AuthSession>('/auth/change-password', { method: 'POST', body }),
  providers: (signal?: AbortSignal) => apiRequest<AuthProviders>('/auth/providers', { signal, ...PUBLIC }),
  signInMethods: (signal?: AbortSignal) => apiRequest<SignInMethods>('/auth/sign-in-methods', { signal }),
  unlinkGoogle: () => apiRequest<void>('/auth/identities/google', { method: 'DELETE' }),
};
