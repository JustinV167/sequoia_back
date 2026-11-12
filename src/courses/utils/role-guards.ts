import { ErrorCodes } from '../../common/constants/error-codes'
import { AppException } from '../../common/exceptions/app.exception'
import { UserRole } from '../../users/enums/user-role.enum'
import type { PublicUser } from '../../users/types/public-user.interface'

export function assertTeacher(user: PublicUser): void {
  if (!user.roles.includes(UserRole.Teacher)) {
    throw new AppException(
      403,
      ErrorCodes.TeacherOnly,
      'Only teachers can perform this action.',
    )
  }
}

export function assertStudent(user: PublicUser): void {
  if (!user.roles.includes(UserRole.Student)) {
    throw new AppException(
      403,
      ErrorCodes.StudentOnly,
      'Only students can perform this action.',
    )
  }
}
