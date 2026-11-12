import type { User } from '../user.entity'
import type { UserRole } from '../enums/user-role.enum'
import type { UserStatus } from '../enums/user-status.enum'

export interface PublicUser {
  id: string
  email: string
  fullName: string
  roles: UserRole[]
  status: UserStatus
  emailVerifiedAt: Date | null
  avatarUrl: string | null
  createdAt: Date
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  }
}
