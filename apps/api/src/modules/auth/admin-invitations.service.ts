import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ADMIN_INVITATION_TTL_HOURS,
  type AcceptInvitationInput,
  type AdminInvitation,
  ErrorCode,
  type InvitationPreview,
  type InvitationStatus,
  type Locale,
} from '@offerleap/shared';

import { AppException } from '../../common/errors/app.exception';
import { isUniqueViolation } from '../../common/errors/prisma-errors';
import { generateOpaqueToken, hashPassword, hashToken } from '../../common/security/hashing';
import type { Env } from '../../config/env.schema';
import type { AdminInvitation as InvitationRow, User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const TTL_MS = ADMIN_INVITATION_TTL_HOURS * 60 * 60 * 1000;

/** Status shown to root, derived from the timestamps. */
function invitationStatus(invitation: InvitationRow, now = new Date()): InvitationStatus {
  if (invitation.acceptedAt) return 'ACCEPTED';
  if (invitation.revokedAt) return 'REVOKED';
  if (invitation.expiresAt <= now) return 'EXPIRED';
  return 'PENDING';
}

const INVITED_BY = { invitedBy: { select: { fullName: true } } } as const;

function toAdminInvitation(invitation: InvitationRow & { invitedBy: { fullName: string } }): AdminInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    status: invitationStatus(invitation),
    invitedBy: invitation.invitedBy.fullName,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
  };
}

/**
 * Invitations for general admins. Root invites by email; the link carries a random token whose SHA-256 is all
 * that is stored (like password reset tokens), so a database leak doesn't leak working links.
 */
@Injectable()
export class AdminInvitationsService {
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  /** Every invitation, newest first. */
  async list(): Promise<AdminInvitation[]> {
    const invitations = await this.prisma.adminInvitation.findMany({
      include: INVITED_BY,
      orderBy: { createdAt: 'desc' },
    });
    return invitations.map(toAdminInvitation);
  }

  /**
   * @description Invites an email address and sends the link.
   * @param inviter - The root admin.
   * @param email - Invitee (normalised by the shared schema).
   * @param locale - Language of the email.
   * @throws AppException AUTH_EMAIL_TAKEN (an account exists) or ADMIN_INVITATION_PENDING (resend instead).
   */
  async invite(inviter: User, email: string, locale: Locale): Promise<AdminInvitation> {
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new AppException(ErrorCode.AUTH_EMAIL_TAKEN);
    }
    const pending = await this.prisma.adminInvitation.findFirst({
      where: { email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (pending) throw new AppException(ErrorCode.ADMIN_INVITATION_PENDING);

    const token = generateOpaqueToken();
    const invitation = await this.prisma.adminInvitation.create({
      data: {
        email,
        tokenHash: hashToken(token),
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    await this.send(invitation.email, inviter.fullName, locale, token);
    return this.find(invitation.id);
  }

  /**
   * @description Sends a fresh link (the old one stops working) and restarts the validity period.
   * @throws AppException COMMON_NOT_FOUND, or COMMON_VALIDATION_FAILED for accepted/revoked invitations.
   */
  async resend(inviter: User, id: string, locale: Locale): Promise<AdminInvitation> {
    const invitation = await this.prisma.adminInvitation.findUnique({ where: { id } });
    if (!invitation) throw new AppException(ErrorCode.COMMON_NOT_FOUND);
    if (invitation.acceptedAt || invitation.revokedAt)
      throw new AppException(ErrorCode.COMMON_VALIDATION_FAILED);

    const token = generateOpaqueToken();
    await this.prisma.adminInvitation.update({
      where: { id },
      data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TTL_MS) },
    });
    await this.send(invitation.email, inviter.fullName, locale, token);
    return this.find(id);
  }

  /** @throws AppException COMMON_NOT_FOUND. Accepted invitations stay as they are. */
  async revoke(id: string): Promise<void> {
    const { count } = await this.prisma.adminInvitation.updateMany({
      where: { id, acceptedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new AppException(ErrorCode.COMMON_NOT_FOUND);
  }

  /**
   * @description What the invitee sees on the set-up page.
   * @throws AppException AUTH_TOKEN_INVALID (unknown, used or revoked) or AUTH_TOKEN_EXPIRED.
   */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.usable(token);
    return { email: invitation.email, expiresAt: invitation.expiresAt.toISOString() };
  }

  /**
   * @description Creates the general admin account (email verified by the link itself) and uses up the
   * invitation, atomically: of two simultaneous attempts only one succeeds.
   * @returns The new account, for starting a session.
   * @throws AppException AUTH_TOKEN_INVALID / AUTH_TOKEN_EXPIRED / AUTH_EMAIL_TAKEN.
   */
  async accept(input: AcceptInvitationInput, locale: Locale): Promise<User> {
    const invitation = await this.usable(input.token);
    if (await this.prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } })) {
      throw new AppException(ErrorCode.AUTH_EMAIL_TAKEN);
    }
    const passwordHash = await hashPassword(input.password);

    return this.prisma
      .$transaction(async (tx) => {
        const { count } = await tx.adminInvitation.updateMany({
          where: { id: invitation.id, acceptedAt: null, revokedAt: null },
          data: { acceptedAt: new Date() },
        });
        if (count === 0) throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
        return tx.user.create({
          data: {
            email: invitation.email,
            fullName: input.fullName,
            passwordHash,
            role: 'ADMIN',
            adminLevel: 'GENERAL',
            locale,
            emailVerifiedAt: new Date(),
          },
        });
      })
      .catch((error: unknown) => {
        // An account with this email appeared meanwhile (e.g. the invitation accepted twice at once).
        if (isUniqueViolation(error)) throw new AppException(ErrorCode.AUTH_EMAIL_TAKEN);
        throw error;
      });
  }

  private async usable(token: string): Promise<InvitationRow> {
    const invitation = await this.prisma.adminInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    const status = invitation && invitationStatus(invitation);
    if (!invitation || status === 'ACCEPTED' || status === 'REVOKED') {
      throw new AppException(ErrorCode.AUTH_TOKEN_INVALID);
    }
    if (status === 'EXPIRED') throw new AppException(ErrorCode.AUTH_TOKEN_EXPIRED);
    return invitation;
  }

  private async find(id: string): Promise<AdminInvitation> {
    return toAdminInvitation(
      await this.prisma.adminInvitation.findUniqueOrThrow({ where: { id }, include: INVITED_BY }),
    );
  }

  private async send(email: string, inviterName: string, locale: Locale, token: string): Promise<void> {
    const link = new URL(`/${locale}/admin-invite`, this.webOrigin);
    link.searchParams.set('token', token);
    await this.mail.send({
      template: 'admin-invitation',
      to: email,
      locale,
      fullName: inviterName,
      link: link.toString(),
    });
  }
}
