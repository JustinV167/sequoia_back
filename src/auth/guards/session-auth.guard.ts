import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common'

import { ErrorCodes } from '../../common/constants/error-codes'
import { AppException } from '../../common/exceptions/app.exception'
import { UserStatus } from '../../users/enums/user-status.enum'
import { toPublicUser } from '../../users/types/public-user.interface'
import type { AuthenticatedRequest } from '../types/authenticated-request.interface'
import { SessionService } from '../sessions/session.service'

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { cookies?: Record<string, unknown> }>()

    const token = request.cookies?.[this.sessions.getCookieName()]

    if (!token || typeof token !== 'string') {
      throw new AppException(
        401,
        ErrorCodes.Unauthenticated,
        'Sign in to continue.',
      )
    }

    const resolved = await this.sessions.resolve(token)

    if (!resolved) {
      throw new AppException(
        401,
        ErrorCodes.Unauthenticated,
        'Sign in to continue.',
      )
    }

    if (resolved.user.status === UserStatus.Suspended) {
      throw new AppException(
        403,
        ErrorCodes.AccountSuspended,
        'Your account is suspended.',
      )
    }

    if (resolved.user.status !== UserStatus.Active) {
      throw new AppException(
        401,
        ErrorCodes.Unauthenticated,
        'Sign in to continue.',
      )
    }

    request.user = toPublicUser(resolved.user)
    request.sessionId = resolved.session.id

    return true
  }
}
