import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminIndustriesService } from './admin-industries.service';
import { AdminInsightsController } from './admin-insights.controller';
import { AdminInvitationsController } from './admin-invitations.controller';
import { AdminUsageService } from './admin-usage.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/** Admin console API. Every route requires the ADMIN role; invitations are root only. */
@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, AdminInvitationsController, AdminInsightsController],
  providers: [AdminUsersService, AdminUsageService, AdminIndustriesService],
})
export class AdminModule {}
