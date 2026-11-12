import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'

import { getSecret } from '../config/secrets'
import { TransactionManager } from '../database/transaction-manager.service'
import { MailModule } from '../mail/mail.module'
import { User } from '../users/user.entity'
import { UsersRepository } from '../users/users.repository'
import { AuthController } from './auth.controller'
import { Session } from './sessions/session.entity'
import { VerificationCode } from './verification/verification-code.entity'
import { SessionAuthGuard } from './guards/session-auth.guard'
import { SessionsRepository } from './sessions/sessions.repository'
import { VerificationCodesRepository } from './verification/verification-codes.repository'
import { AuthService } from './auth.service'
import { OtpService } from './verification/otp.service'
import { PasswordService } from './password.service'
import { RateLimitService } from './rate-limit.service'
import { SessionService } from './sessions/session.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([User, VerificationCode, Session]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: getSecret(
          config,
          'REGISTRATION_TOKEN_SECRET',
          'dev-registration-secret-change-me',
        ),
        signOptions: {
          expiresIn: Number(
            config.get<string>('REGISTRATION_TOKEN_TTL_SECONDS', '900'),
          ),
        },
      }),
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    UsersRepository,
    VerificationCodesRepository,
    SessionsRepository,
    TransactionManager,
    AuthService,
    OtpService,
    PasswordService,
    RateLimitService,
    SessionService,
    SessionAuthGuard,
  ],
  exports: [SessionAuthGuard, SessionService, UsersRepository],
})
export class AuthModule {}
