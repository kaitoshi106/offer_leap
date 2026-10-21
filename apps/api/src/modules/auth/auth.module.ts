import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import type { Env } from '../../config/env.schema';
import { AccountModule } from '../account/account.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AdminInvitationsService } from './admin-invitations.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthProvider } from './oauth/google-oauth.provider';
import { MockOAuthProvider } from './oauth/mock-oauth.provider';
import { OAuthController } from './oauth/oauth.controller';
import { oauthCallbackUrl } from './oauth/oauth.cookies';
import { OAuthService } from './oauth/oauth.service';
import { OAUTH_PROVIDER, type OAuthProvider } from './oauth/oauth.types';
import { TokenService } from './token.service';
import { UserTokenService } from './user-token.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    AccountModule,
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
  controllers: [AuthController, OAuthController],
  providers: [
    AuthService,
    TokenService,
    UserTokenService,
    AdminInvitationsService,
    OAuthService,
    {
      provide: OAUTH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): OAuthProvider => {
        const redirectUri = oauthCallbackUrl(config.get('API_PUBLIC_URL', { infer: true }));
        return config.get('OAUTH_PROVIDER', { infer: true }) === 'mock'
          ? new MockOAuthProvider(redirectUri)
          : new GoogleOAuthProvider(
              config.get('GOOGLE_CLIENT_ID', { infer: true }),
              config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
              redirectUri,
            );
      },
    },
  ],
  exports: [TokenService, AdminInvitationsService],
})
export class AuthModule {}
