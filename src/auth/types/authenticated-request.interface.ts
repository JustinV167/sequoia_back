import type { Request } from 'express'

import type { PublicUser } from '../../users/types/public-user.interface'

export interface AuthenticatedRequest extends Request {
  user?: PublicUser
  sessionId?: string
}
