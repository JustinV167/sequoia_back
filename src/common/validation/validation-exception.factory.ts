import { HttpStatus } from '@nestjs/common'
import type { ValidationError } from 'class-validator'

import { ErrorCodes, type ErrorCode } from '../constants/error-codes'
import { AppException } from '../exceptions/app.exception'

const FIELD_CODES: Record<string, ErrorCode> = {
  email: ErrorCodes.InvalidEmail,
  fullName: ErrorCodes.InvalidFullName,
  password: ErrorCodes.WeakPassword,
  role: ErrorCodes.InvalidRole,
  code: ErrorCodes.OtpInvalid,
  registrationToken: ErrorCodes.RegistrationTokenInvalid,
  title: ErrorCodes.InvalidCourseTitle,
  subject: ErrorCodes.InvalidCourseSubject,
  description: ErrorCodes.InvalidCourseDescription,
  level: ErrorCodes.InvalidCourseLevel,
  durationMinutes: ErrorCodes.InvalidCourseDuration,
  coverUrl: ErrorCodes.InvalidCourseCover,
}

const FIELD_MESSAGES: Record<string, string> = {
  email: 'Enter a valid email address.',
  fullName: 'Enter a valid full name.',
  password: 'Password must be at least 8 characters long.',
  role: 'Select a valid role.',
  code: 'Enter the 6-digit code.',
  registrationToken: 'Invalid registration token.',
  title: 'Enter a valid course title.',
  subject: 'Enter a valid course subject.',
  description: 'Enter a valid course description.',
  level: 'Select a valid course level.',
  durationMinutes: 'Enter a valid course duration.',
  coverUrl: 'Enter a valid course cover.',
}

export function validationExceptionFactory(
  errors: ValidationError[],
): AppException {
  const firstError = errors[0]

  if (!firstError) {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCodes.InvalidRequest,
      'Check the submitted data.',
    )
  }

  const constraints = firstError.constraints
    ? Object.values(firstError.constraints)
    : []

  return new AppException(
    HttpStatus.BAD_REQUEST,
    FIELD_CODES[firstError.property] ?? ErrorCodes.InvalidRequest,
    constraints[0] ??
      FIELD_MESSAGES[firstError.property] ??
      'Check the submitted data.',
  )
}
