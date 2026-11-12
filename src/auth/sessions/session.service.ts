import { createHmac, randomBytes } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Response } from 'express'

import type { ClientMeta } from '../../common/utils/client-meta'
import { getSecret } from '../../config/secrets'
import { User } from '../../users/user.entity'
import { UserStatus } from '../../users/enums/user-status.enum'
import { Session } from './session.entity'
import { SessionsRepository } from './sessions.repository'

const DEFAULT_SESSION_TTL_DAYS = 7
const MAX_USER_AGENT_LENGTH = 512
const MAX_IP_LENGTH = 64

export interface CreatedSession {
  token: string
  session: Session
}

export interface ResolvedSession {
  session: Session
  user: User
}

@Injectable()
export class SessionService {
  private readonly secret: string
  private readonly cookieName: string
  private readonly cookieSecure: boolean
  private readonly ttlMs: number

  constructor(
    private readonly sessions: SessionsRepository,
    config: ConfigService,
  ) {
    this.secret = getSecret(
      config,
      'SESSION_SECRET',
      'dev-session-secret-change-me',
    )
    this.cookieName = config.get<string>(
      'SESSION_COOKIE_NAME',
      'sequoia_session',
    )
    this.cookieSecure =
      config.get<string>('COOKIE_SECURE', 'false') === 'true' ||
      config.get<string>('NODE_ENV') === 'production'

    const configuredDays = Number(
      config.get<string>('SESSION_TTL_DAYS', String(DEFAULT_SESSION_TTL_DAYS)),
    )
    const days =
      Number.isFinite(configuredDays) && configuredDays > 0
        ? configuredDays
        : DEFAULT_SESSION_TTL_DAYS

    this.ttlMs = days * 24 * 60 * 60 * 1000
  }

  async create(user: User, meta: ClientMeta): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url')
    const now = new Date()

    const session = await this.sessions.create({
      tokenHash: this.hashToken(token),
      userId: user.id,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      lastUsedAt: now,
      ipAddress: meta.ipAddress ? meta.ipAddress.slice(0, MAX_IP_LENGTH) : null,
      userAgent: meta.userAgent
        ? meta.userAgent.slice(0, MAX_USER_AGENT_LENGTH)
        : null,
    })

    return { token, session }
  }

  async resolve(token: string): Promise<ResolvedSession | null> {
    const session = await this.sessions.findByTokenHashWithUser(
      this.hashToken(token),
    )

    if (!session) {
      return null
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessions.deleteById(session.id)
      return null
    }

    if (!session.user || session.user.status === UserStatus.Deleted) {
      await this.sessions.deleteById(session.id)
      return null
    }

    return { session, user: session.user }
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.deleteById(sessionId)
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessions.deleteByUserId(userId)
  }

  getCookieName(): string {
    return this.cookieName
  }

  setSessionCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })
  }

  clearSessionCookie(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: '/',
    })
  }

  private hashToken(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('hex')
  }
}
