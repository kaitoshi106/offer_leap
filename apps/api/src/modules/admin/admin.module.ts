import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminInvitationsController } from './admin-invitations.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/** Admin console API. Every route requires the ADMIN role; invitations are root only. */
@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, AdminInvitationsController],
  providers: [AdminUsersService],
})
export class AdminModule {}
