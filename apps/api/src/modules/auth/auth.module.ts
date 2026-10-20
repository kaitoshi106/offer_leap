import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import type { Env } from '../../config/env.schema';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AdminInvitationsService } from './admin-invitations.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { UserTokenService } from './user-token.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, UserTokenService, AdminInvitationsService],
  exports: [TokenService, AdminInvitationsService],
})
export class AuthModule {}
