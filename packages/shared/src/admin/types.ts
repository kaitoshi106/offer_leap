import type { SignInMethod } from '../auth/oauth';
import type { AdminLevel, Role } from '../auth/roles';
import type { CareerLevel } from '../profile/constants';
import type { InvitationStatus, UserStatus } from './constants';

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  adminLevel: AdminLevel | null;
  status: UserStatus;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  /** Password and/or linked providers (Google); empty only for an account that can't sign in yet. */
  signInMethods: SignInMethod[];
  lastLoginAt: string | null;
  createdAt: string;
}

/** `GET /admin/users/:id`: account, career summary and activity counts. Never contains secrets or documents. */
export interface AdminUserDetail extends AdminUserListItem {
  profile: {
    jobTitle: string | null;
    level: CareerLevel | null;
    yearsOfExperience: number | null;
    provinceCode: string | null;
    industryCode: string | null;
  } | null;
  activity: { resumes: number; analyses: number; applications: number; interviews: number };
  ai: {
    /** Successful AI calls in the last 24 hours. */
    callsInWindow: number;
    /** Limit that applies (override or default); null for admins, who have no limit. */
    limit: number | null;
    /** Per-user override set by an admin; null = default. */
    override: number | null;
  };
  /** Whether the viewing admin may disable/enable this account (see `canManageAccount`). */
  manageable: boolean;
}

export interface AdminInvitation {
  id: string;
  email: string;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

/** `GET /auth/admin-invitations/:token`: what the invitee sees before setting up the account. */
export interface InvitationPreview {
  email: string;
  expiresAt: string;
}
