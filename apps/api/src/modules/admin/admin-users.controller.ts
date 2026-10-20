import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUsersQuery,
  adminUsersQuerySchema,
  ErrorCode,
  type Paginated,
  Role,
  type UpdateUserStatusInput,
  updateUserStatusSchema,
} from '@offerleap/shared';

import { CurrentUser, Roles } from '../../common/decorators/auth.decorators';
import type { AccessTokenPayload } from '../../common/http/request';
import { ApiErrors, ApiZodBody } from '../../common/openapi/openapi.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminUsersService } from './admin-users.service';

@ApiTags('admin')
@ApiCookieAuth('cookie')
@Roles(Role.ADMIN)
@ApiErrors(ErrorCode.AUTH_UNAUTHENTICATED, ErrorCode.AUTH_FORBIDDEN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @ApiOperation({ summary: 'Search accounts (paginated)' })
  @ApiErrors(ErrorCode.COMMON_VALIDATION_FAILED)
  @Get()
  list(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<Paginated<AdminUserListItem>> {
    return this.users.list(query);
  }

  @ApiOperation({ summary: 'Account details, career summary and activity counts' })
  @ApiErrors(ErrorCode.COMMON_NOT_FOUND)
  @Get(':id')
  detail(@CurrentUser() actor: AccessTokenPayload, @Param('id') id: string): Promise<AdminUserDetail> {
    return this.users.detail(actor, id);
  }

  @ApiOperation({
    summary: 'Disable or enable an account',
    description:
      'Disabling signs the account out everywhere. General admins can manage users only; root can also manage general admins. Nobody can change themselves or root.',
  })
  @ApiZodBody(updateUserStatusSchema)
  @ApiErrors(
    ErrorCode.COMMON_VALIDATION_FAILED,
    ErrorCode.COMMON_NOT_FOUND,
    ErrorCode.ADMIN_ACTION_NOT_ALLOWED,
  )
  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) body: UpdateUserStatusInput,
  ): Promise<AdminUserDetail> {
    return this.users.setStatus(actor, id, body.status);
  }
}
