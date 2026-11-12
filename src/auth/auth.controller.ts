import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ResponseMessage } from '../common/decorators/response-message.decorator'
import { getClientMeta } from '../common/utils/client-meta'
import type { PublicUser } from '../users/types/public-user.interface'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { ResetPasswordDto } from './dto/reset-password.dto'
import { SendOtpDto } from './dto/send-otp.dto'
import { VerifyOtpDto } from './dto/verify-otp.dto'
import { SessionAuthGuard } from './guards/session-auth.guard'
import {
  AuthService,
  type AuthenticatedResult,
  type LoginResult,
  type ResetOtpResult,
  type SendOtpResult,
  type VerifyOtpResult,
} from './auth.service'
import { SessionService } from './sessions/session.service'
import type { AuthenticatedRequest } from './types/authenticated-request.interface'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register/send-otp')
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Code sent to your email.')
  async sendRegistrationOtp(
    @Body() dto: SendOtpDto,
    @Req() request: Request,
  ): Promise<SendOtpResult> {
    return this.auth.sendRegistrationOtp(dto, getClientMeta(request))
  }

  @Post('register/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email verified successfully.')
  async verifyRegistrationOtp(
    @Body() dto: VerifyOtpDto,
    @Req() request: Request,
  ): Promise<VerifyOtpResult> {
    return this.auth.verifyRegistrationOtp(dto, getClientMeta(request))
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Account created successfully.')
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: PublicUser }> {
    const result: AuthenticatedResult = await this.auth.register(
      dto,
      getClientMeta(request),
    )

    this.sessions.setSessionCookie(
      response,
      result.sessionToken,
      result.sessionExpiresAt,
    )

    return { user: result.user }
  }

  @Post('forgot-password/send-otp')
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage(
    'If an account exists for this email, a recovery code has been sent.',
  )
  async sendPasswordResetOtp(
    @Body() dto: SendOtpDto,
    @Req() request: Request,
  ): Promise<SendOtpResult> {
    return this.auth.sendPasswordResetOtp(dto, getClientMeta(request))
  }

  @Post('forgot-password/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Code verified successfully.')
  async verifyPasswordResetOtp(
    @Body() dto: VerifyOtpDto,
    @Req() request: Request,
  ): Promise<ResetOtpResult> {
    return this.auth.verifyPasswordResetOtp(dto, getClientMeta(request))
  }

  @Post('forgot-password/reset')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password updated successfully.')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.resetPassword(dto, getClientMeta(request))
    this.sessions.clearSessionCookie(response)
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Signed in successfully.')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: PublicUser; landingRole: LoginResult['landingRole'] }> {
    const result = await this.auth.login(dto, getClientMeta(request))

    this.sessions.setSessionCookie(
      response,
      result.sessionToken,
      result.sessionExpiresAt,
    )

    return {
      user: result.user,
      landingRole: result.landingRole,
    }
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Signed out successfully.')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (request.sessionId) {
      await this.auth.logout(request.sessionId)
    }

    this.sessions.clearSessionCookie(response)
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User data.')
  me(@CurrentUser() user: PublicUser): { user: PublicUser } {
    return { user }
  }
}
