import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import type { ClientMeta } from '../common/utils/client-meta'
import { normalizeEmail } from '../common/utils/normalize-email'
import { TransactionManager } from '../database/transaction-manager.service'
import { MailService } from '../mail/mail.service'
import type { User } from '../users/user.entity'
import { UserRole } from '../users/enums/user-role.enum'
import { UserStatus } from '../users/enums/user-status.enum'
import { EmailAlreadyExistsError } from '../users/errors/email-already-exists.error'
import { UsersRepository } from '../users/users.repository'
import {
  toPublicUser,
  type PublicUser,
} from '../users/types/public-user.interface'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'
import type { ResetPasswordDto } from './dto/reset-password.dto'
import type { SendOtpDto } from './dto/send-otp.dto'
import type { VerifyOtpDto } from './dto/verify-otp.dto'
import { VerificationPurpose } from './verification/enums/verification-purpose.enum'
import { VerificationCodesRepository } from './verification/verification-codes.repository'
import type { RegistrationTokenPayload } from './types/registration-token-payload.interface'
import { OtpService } from './verification/otp.service'
import { PasswordService } from './password.service'
import { RateLimitService } from './rate-limit.service'
import { SessionService } from './sessions/session.service'

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_RESEND_COOLDOWN_MS = 60 * 1000
const MAX_OTP_ATTEMPTS = 5
const REGISTRATION_TOKEN_TTL_SECONDS = 15 * 60

const OTP_SEND_IP_LIMIT = 10
const OTP_SEND_IP_WINDOW_MS = 15 * 60 * 1000
const OTP_SEND_EMAIL_LIMIT = 5
const OTP_SEND_EMAIL_WINDOW_MS = 60 * 60 * 1000
const OTP_VERIFY_IP_LIMIT = 20
const OTP_VERIFY_IP_WINDOW_MS = 15 * 60 * 1000
const OTP_VERIFY_EMAIL_LIMIT = 10
const OTP_VERIFY_EMAIL_WINDOW_MS = 15 * 60 * 1000
const LOGIN_IP_LIMIT = 20
const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000
const REGISTER_IP_LIMIT = 10
const REGISTER_IP_WINDOW_MS = 60 * 60 * 1000
const RESET_SEND_IP_LIMIT = 10
const RESET_SEND_IP_WINDOW_MS = 15 * 60 * 1000
const RESET_SEND_EMAIL_LIMIT = 5
const RESET_SEND_EMAIL_WINDOW_MS = 60 * 60 * 1000
const RESET_VERIFY_IP_LIMIT = 20
const RESET_VERIFY_IP_WINDOW_MS = 15 * 60 * 1000
const RESET_VERIFY_EMAIL_LIMIT = 10
const RESET_VERIFY_EMAIL_WINDOW_MS = 15 * 60 * 1000
const RESET_IP_LIMIT = 10
const RESET_IP_WINDOW_MS = 60 * 60 * 1000

export interface SendOtpResult {
  expiresIn: number
  resendAfter: number
}

export interface VerifyOtpResult {
  registrationToken: string
  expiresIn: number
  /** True when the email already belongs to an account. */
  accountExists: boolean
  /** Roles already assigned to that account (empty for new emails). */
  roles: UserRole[]
}

export interface ResetOtpResult {
  verified: boolean
  expiresIn: number
}

export interface AuthenticatedResult {
  user: PublicUser
  sessionToken: string
  sessionExpiresAt: Date
}

export interface LoginResult extends AuthenticatedResult {
  landingRole: UserRole
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly users: UsersRepository,
    private readonly verificationCodes: VerificationCodesRepository,
    private readonly transactions: TransactionManager,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly otp: OtpService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async sendRegistrationOtp(
    dto: SendOtpDto,
    meta: ClientMeta,
  ): Promise<SendOtpResult> {
    const email = normalizeEmail(dto.email)
    const ipAddress = meta.ipAddress ?? 'unknown'

    this.rateLimit.consumeOrThrow(
      `otp:send:ip:${ipAddress}`,
      OTP_SEND_IP_LIMIT,
      OTP_SEND_IP_WINDOW_MS,
    )
    this.rateLimit.consumeOrThrow(
      `otp:send:email:${email}`,
      OTP_SEND_EMAIL_LIMIT,
      OTP_SEND_EMAIL_WINDOW_MS,
    )

    const now = new Date()
    const latestCode = await this.verificationCodes.findLatestByEmailAndPurpose(
      email,
      VerificationPurpose.Register,
    )

    if (latestCode) {
      const elapsedMs = now.getTime() - latestCode.createdAt.getTime()
      if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000),
        )
        throw new AppException(
          429,
          ErrorCodes.OtpResendTooSoon,
          `Wait ${retryAfterSeconds} seconds before requesting another code.`,
        )
      }
    }

    const code = this.otp.generate()
    const codeHash = this.otp.hash(email, VerificationPurpose.Register, code)

    await this.verificationCodes.invalidateUnconsumed(
      email,
      VerificationPurpose.Register,
      now,
    )

    const verificationCode = await this.verificationCodes.create({
      email,
      purpose: VerificationPurpose.Register,
      codeHash,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    })

    try {
      await this.mail.sendRegistrationOtp(email, code)
    } catch (error) {
      await this.verificationCodes.deleteById(verificationCode.id)
      this.logger.error(
        `Could not send registration OTP to ${email}`,
        error instanceof Error ? error.stack : String(error),
      )
      throw new AppException(
        502,
        ErrorCodes.EmailSendFailed,
        'We could not send the email. Try again.',
      )
    }

    return {
      expiresIn: Math.floor(OTP_TTL_MS / 1000),
      resendAfter: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    }
  }

  async verifyRegistrationOtp(
    dto: VerifyOtpDto,
    meta: ClientMeta,
  ): Promise<VerifyOtpResult> {
    const email = normalizeEmail(dto.email)
    const ipAddress = meta.ipAddress ?? 'unknown'

    this.rateLimit.consumeOrThrow(
      `otp:verify:ip:${ipAddress}`,
      OTP_VERIFY_IP_LIMIT,
      OTP_VERIFY_IP_WINDOW_MS,
    )
    this.rateLimit.consumeOrThrow(
      `otp:verify:email:${email}`,
      OTP_VERIFY_EMAIL_LIMIT,
      OTP_VERIFY_EMAIL_WINDOW_MS,
    )

    const code = await this.verificationCodes.findLatestUnconsumed(
      email,
      VerificationPurpose.Register,
    )

    if (!code) {
      throw new AppException(
        400,
        ErrorCodes.OtpNotRequested,
        'Request a verification code before continuing.',
      )
    }

    const now = new Date()

    if (code.expiresAt.getTime() <= now.getTime()) {
      code.consumedAt = now
      await this.verificationCodes.save(code)
      throw new AppException(
        400,
        ErrorCodes.OtpExpired,
        'The code has expired. Request a new one.',
      )
    }

    if (code.attempts >= MAX_OTP_ATTEMPTS) {
      code.consumedAt = now
      await this.verificationCodes.save(code)
      throw new AppException(
        400,
        ErrorCodes.OtpAttemptsExceeded,
        'You have exceeded the maximum number of attempts. Request a new code.',
      )
    }

    if (
      !this.otp.matches(
        code.codeHash,
        email,
        VerificationPurpose.Register,
        dto.code,
      )
    ) {
      code.attempts += 1

      if (code.attempts >= MAX_OTP_ATTEMPTS) {
        code.consumedAt = now
        await this.verificationCodes.save(code)
        throw new AppException(
          400,
          ErrorCodes.OtpAttemptsExceeded,
          'You have exceeded the maximum number of attempts. Request a new code.',
        )
      }

      await this.verificationCodes.save(code)
      throw new AppException(
        400,
        ErrorCodes.OtpInvalid,
        'The code is incorrect.',
      )
    }

    code.verifiedAt = code.verifiedAt ?? now
    await this.verificationCodes.save(code)

    const registrationToken = await this.jwt.signAsync({
      sub: code.id,
      email,
      purpose: VerificationPurpose.Register,
    } satisfies RegistrationTokenPayload)

    const user = await this.users.findByEmail(email)

    return {
      registrationToken,
      expiresIn: REGISTRATION_TOKEN_TTL_SECONDS,
      accountExists: Boolean(user),
      roles: user?.roles ?? [],
    }
  }

  async register(
    dto: RegisterDto,
    meta: ClientMeta,
  ): Promise<AuthenticatedResult> {
    const email = normalizeEmail(dto.email)
    const ipAddress = meta.ipAddress ?? 'unknown'

    this.rateLimit.consumeOrThrow(
      `register:ip:${ipAddress}`,
      REGISTER_IP_LIMIT,
      REGISTER_IP_WINDOW_MS,
    )

    let payload: RegistrationTokenPayload

    try {
      payload = await this.jwt.verifyAsync<RegistrationTokenPayload>(
        dto.registrationToken,
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new AppException(
          400,
          ErrorCodes.RegistrationTokenExpired,
          'The registration token has expired. Verify your email again.',
        )
      }

      throw new AppException(
        400,
        ErrorCodes.RegistrationTokenInvalid,
        'Invalid registration token.',
      )
    }

    if (
      payload.purpose !== VerificationPurpose.Register ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      throw new AppException(
        400,
        ErrorCodes.RegistrationTokenInvalid,
        'Invalid registration token.',
      )
    }

    if (normalizeEmail(payload.email) !== email) {
      throw new AppException(
        400,
        ErrorCodes.EmailMismatch,
        'The email does not match the verified email.',
      )
    }

    const passwordHash = dto.password
      ? await this.passwords.hash(dto.password)
      : null
    let user: User

    try {
      user = await this.transactions.run(
        async ({ users, verificationCodes }) => {
          const code = await verificationCodes.findByIdForUpdate(payload.sub)

          if (
            !code ||
            code.purpose !== VerificationPurpose.Register ||
            code.email !== email
          ) {
            throw new AppException(
              400,
              ErrorCodes.RegistrationTokenInvalid,
              'Invalid registration token.',
            )
          }

          if (code.consumedAt) {
            throw new AppException(
              400,
              ErrorCodes.RegistrationTokenUsed,
              'This registration token has already been used.',
            )
          }

          if (!code.verifiedAt) {
            throw new AppException(
              400,
              ErrorCodes.OtpNotVerified,
              'Verify your email before creating the account.',
            )
          }

          const existingUser = await users.findByEmail(email)

          if (existingUser) {
            if (existingUser.status !== UserStatus.Active) {
              throw new AppException(
                403,
                existingUser.status === UserStatus.Suspended
                  ? ErrorCodes.AccountSuspended
                  : ErrorCodes.Forbidden,
                'This account is not active.',
              )
            }

            if (existingUser.roles.includes(dto.role)) {
              throw new AppException(
                409,
                ErrorCodes.EmailExist,
                'This email is already registered.',
              )
            }

            const roles = [...existingUser.roles, dto.role]

            await users.updateRoles(existingUser.id, roles)

            await verificationCodes.markConsumed(code.id, new Date())

            existingUser.roles = roles

            return existingUser
          }

          if (!passwordHash) {
            throw new AppException(
              400,
              ErrorCodes.WeakPassword,
              'Enter a password to create the account.',
            )
          }

          const createdUser = await users.create({
            email,
            passwordHash,
            fullName: dto.fullName.trim(),
            roles: [dto.role],
            status: UserStatus.Active,
            emailVerifiedAt: new Date(),
          })

          await verificationCodes.markConsumed(code.id, new Date())

          return createdUser
        },
      )
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new AppException(
          409,
          ErrorCodes.EmailExist,
          'This email is already registered.',
        )
      }

      throw error
    }

    const session = await this.sessions.create(user, meta)

    return {
      user: toPublicUser(user),
      sessionToken: session.token,
      sessionExpiresAt: session.session.expiresAt,
    }
  }

  async login(dto: LoginDto, meta: ClientMeta): Promise<LoginResult> {
    const email = normalizeEmail(dto.email)
    const ipAddress = meta.ipAddress ?? 'unknown'

    this.rateLimit.consumeOrThrow(
      `login:ip:${ipAddress}`,
      LOGIN_IP_LIMIT,
      LOGIN_IP_WINDOW_MS,
    )

    const user = await this.users.findByEmailWithPassword(email)

    if (!user) {
      await this.passwords.consumeDummy(dto.password)
      throw new AppException(
        401,
        ErrorCodes.InvalidCredentials,
        'Incorrect email or password.',
      )
    }

    const passwordMatches = await this.passwords.verify(
      user.passwordHash,
      dto.password,
    )

    if (!passwordMatches) {
      throw new AppException(
        401,
        ErrorCodes.InvalidCredentials,
        'Incorrect email or password.',
      )
    }

    if (user.status === UserStatus.Suspended) {
      throw new AppException(
        403,
        ErrorCodes.AccountSuspended,
        'Your account is suspended.',
      )
    }

    if (user.status !== UserStatus.Active) {
      throw new AppException(
        401,
        ErrorCodes.InvalidCredentials,
        'Incorrect email or password.',
      )
    }

    if (!user.roles.includes(dto.role)) {
      throw new AppException(
        403,
        ErrorCodes.RoleNotAssigned,
        'Your account does not have access to this interface.',
      )
    }

    const now = new Date()
    await this.users.updateLastLogin(user.id, now)
    user.lastLoginAt = now

    const session = await this.sessions.create(user, meta)

    return {
      user: toPublicUser(user),
      sessionToken: session.token,
      sessionExpiresAt: session.session.expiresAt,
      landingRole: dto.role,
    }
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId)
  }

  /**
   * Starts the forgot-password flow. A verification code is always created and
   * the response is identical whether or not the account exists, so the
   * endpoint cannot be used to enumerate users. Mail is only delivered for
   * real accounts.
   */
  async sendPasswordResetOtp(
    dto: SendOtpDto,
    meta: ClientMeta,
  ): Promise<SendOtpResult> {
    const email = normalizeEmail(dto.email)
    const ipAddress = meta.ipAddress ?? 'unknown'

    this.rateLimit.consumeOrThrow(
      `password:reset:send:ip:${ipAddress}`,
      RESET_SEND_IP_LIMIT,
      RESET_SEND_IP_WINDOW_MS,
    )

    const now = new Date()
    const latestCode = await this.verificationCodes.findLatestByEmailAndPurpose(
      email,
      VerificationPurpose.ResetPassword,
    )

    if (latestCode) {
      const elapsedMs = now.getTime() - latestCode.createdAt.getTime()
      if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000),
        )
        throw new AppException(
          429,
          ErrorCodes.OtpResendTooSoon,
          `Wait ${retryAfterSeconds} seconds before requesting another code.`,
        )
      }
    }

    // Consumed only when a code is actually issued, so re-clicking while the
    // cooldown is active never eats into the hourly quota of the account.
    this.rateLimit.consumeOrThrow(
      `password:reset:send:email:${email}`,
      RESET_SEND_EMAIL_LIMIT,
      RESET_SEND_EMAIL_WINDOW_MS,
    )

    const code = this.otp.generate()
    const codeHash = this.otp.hash(
      email,
      VerificationPurpose.ResetPassword,
      code,
    )

    await this.verificationCodes.invalidateUnconsumed(
      email,
      VerificationPurpose.ResetPassword,
      now,
    )

    const verificationCode = await this.verificationCodes.create({
      email,
      purpose: VerificationPurpose.ResetPassword,
      codeHash,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    })

    if (await this.users.existsByEmail(email)) {
      try {
        await this.mail.sendPasswordResetOtp(email, code)
      } catch (error) {
        await this.verificationCodes.deleteById(verificationCode.id)
        this.logger.error(
          `Could not send password reset OTP to ${email}`,
          error instanceof Error ? error.stack : String(error),
        )
        throw new AppException(
          502,
          ErrorCodes.EmailSendFailed,
          'We could not send the email. Try again.',
        )
      }
    }

    return {
      expiresIn: Math.floor(OTP_TTL_MS / 1000),
      resendAfter: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    }
  }

  async verifyPasswordResetOtp(
    dto: VerifyOtpDto,
    meta: ClientMeta,
  ): Promise<ResetOtpResult> {
    const email = normalizeEmail(dto.email)
    const ipAddress = meta.ipAddress ?? 'unknown'

    this.rateLimit.consumeOrThrow(
      `password:reset:verify:ip:${ipAddress}`,
      RESET_VERIFY_IP_LIMIT,
      RESET_VERIFY_IP_WINDOW_MS,
    )
    this.rateLimit.consumeOrThrow(
      `password:reset:verify:email:${email}`,
      RESET_VERIFY_EMAIL_LIMIT,
      RESET_VERIFY_EMAIL_WINDOW_MS,
    )

    const code = await this.verificationCodes.findLatestUnconsumed(
      email,
      VerificationPurpose.ResetPassword,
    )

    if (!code) {
      throw new AppException(
        400,
        ErrorCodes.OtpNotRequested,
        'Request a verification code before continuing.',
      )
    }

    const now = new Date()

    if (code.expiresAt.getTime() <= now.getTime()) {
      code.consumedAt = now
      await this.verificationCodes.save(code)
      throw new AppException(
        400,
        ErrorCodes.OtpExpired,
        'The code has expired. Request a new one.',
      )
    }

    if (code.attempts >= MAX_OTP_ATTEMPTS) {
      code.consumedAt = now
      await this.verificationCodes.save(code)
      throw new AppException(
        400,
        ErrorCodes.OtpAttemptsExceeded,
        'You have exceeded the maximum number of attempts. Request a new code.',
      )
    }

    if (
      !this.otp.matches(
        code.codeHash,
        email,
        VerificationPurpose.ResetPassword,
        dto.code,
      )
    ) {
      code.attempts += 1

      if (code.attempts >= MAX_OTP_ATTEMPTS) {
        code.consumedAt = now
        await this.verificationCodes.save(code)
        throw new AppException(
          400,
          ErrorCodes.OtpAttemptsExceeded,
          'You have exceeded the maximum number of attempts. Request a new code.',
        )
      }

      await this.verificationCodes.save(code)
      throw new AppException(
        400,
        ErrorCodes.OtpInvalid,
        'The code is incorrect.',
      )
    }

    code.verifiedAt = code.verifiedAt ?? now
    await this.verificationCodes.save(code)

    return {
      verified: true,
      expiresIn: Math.max(
        1,
        Math.ceil((code.expiresAt.getTime() - now.getTime()) / 1000),
      ),
    }
  }

  async resetPassword(dto: ResetPasswordDto, meta: ClientMeta): Promise<void> {
    const email = normalizeEmail(dto.email)
    const ipAddress = meta.ipAddress ?? 'unknown'

    this.rateLimit.consumeOrThrow(
      `password:reset:ip:${ipAddress}`,
      RESET_IP_LIMIT,
      RESET_IP_WINDOW_MS,
    )

    const passwordHash = await this.passwords.hash(dto.password)

    const user = await this.transactions.run(
      async ({ users, verificationCodes }) => {
        const latest = await verificationCodes.findLatestUnconsumed(
          email,
          VerificationPurpose.ResetPassword,
        )

        if (!latest) {
          throw new AppException(
            400,
            ErrorCodes.OtpNotRequested,
            'Request a verification code before continuing.',
          )
        }

        const code = await verificationCodes.findByIdForUpdate(latest.id)

        if (
          !code ||
          code.purpose !== VerificationPurpose.ResetPassword ||
          code.email !== email
        ) {
          throw new AppException(
            400,
            ErrorCodes.OtpNotRequested,
            'Request a verification code before continuing.',
          )
        }

        if (code.consumedAt) {
          throw new AppException(
            400,
            ErrorCodes.OtpUsed,
            'This code has already been used. Request a new one.',
          )
        }

        const now = new Date()

        if (code.expiresAt.getTime() <= now.getTime()) {
          code.consumedAt = now
          await verificationCodes.save(code)
          throw new AppException(
            400,
            ErrorCodes.OtpExpired,
            'The code has expired. Request a new one.',
          )
        }

        if (code.attempts >= MAX_OTP_ATTEMPTS) {
          code.consumedAt = now
          await verificationCodes.save(code)
          throw new AppException(
            400,
            ErrorCodes.OtpAttemptsExceeded,
            'You have exceeded the maximum number of attempts. Request a new code.',
          )
        }

        if (
          !this.otp.matches(
            code.codeHash,
            email,
            VerificationPurpose.ResetPassword,
            dto.code,
          )
        ) {
          code.attempts += 1

          if (code.attempts >= MAX_OTP_ATTEMPTS) {
            code.consumedAt = now
            await verificationCodes.save(code)
            throw new AppException(
              400,
              ErrorCodes.OtpAttemptsExceeded,
              'You have exceeded the maximum number of attempts. Request a new code.',
            )
          }

          await verificationCodes.save(code)
          throw new AppException(
            400,
            ErrorCodes.OtpInvalid,
            'The code is incorrect.',
          )
        }

        const user = await users.findByEmailWithPassword(email)

        if (!user) {
          throw new AppException(404, ErrorCodes.NotFound, 'Account not found.')
        }

        await users.updatePassword(user.id, passwordHash)
        await verificationCodes.markConsumed(code.id, now)

        return user
      },
    )

    await this.sessions.revokeAllForUser(user.id)
  }
}
