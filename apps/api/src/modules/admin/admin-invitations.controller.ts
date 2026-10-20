import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminInvitation,
  ErrorCode,
  type InviteAdminInput,
  inviteAdminSchema,
  localeSchema,
} from '@offerleap/shared';
import { z } from 'zod';

import { CurrentUser, RootOnly } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminInvitationsService } from '../auth/admin-invitations.service';

const resendSchema = z.object({ locale: localeSchema });

@ApiTags('admin')
@ApiCookieAuth('cookie')
@RootOnly()
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_FORBIDDEN)
@Controller('admin/invitations')
export class AdminInvitationsController {
  constructor(
    private readonly invitations: AdminInvitationsService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Admin invitations (root only)' })
  @Get()
  list(): Promise<AdminInvitation[]> {
    return this.invitations.list();
  }

  @ApiOperation({ summary: 'Invite a general admin by email (root only)' })
  @ApiZodBody(inviteAdminSchema)
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.AUTH_EMAIL_TAKEN,
    ErrorCode.ADMIN_INVITATION_PENDING,
  )
  @Post()
  async invite(
    @CurrentUser() actor: AccessTokenPayload,
    @Body(new ZodValidationPipe(inviteAdminSchema)) body: InviteAdminInput,
  ): Promise<AdminInvitation> {
    const inviter = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.sub } });
    return this.invitations.invite(inviter, body.email, body.locale);
  }

  @ApiOperation({ summary: 'Send a new link (the previous one stops working)' })
  @ApiZodBody(resendSchema)
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND, ErrorCode.COMMON_VALIDATION_FAILED)
  @HttpCode(HttpStatus.OK)
  @Post(':id/resend')
  async resend(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resendSchema)) body: z.infer<typeof resendSchema>,
  ): Promise<AdminInvitation> {
    const inviter = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.sub } });
    return this.invitations.resend(inviter, id, body.locale);
  }

  @ApiOperation({ summary: 'Revoke a pending invitation' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  revoke(@Param('id') id: string): Promise<void> {
    return this.invitations.revoke(id);
  }
}
