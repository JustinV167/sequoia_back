import { HttpException } from '@nestjs/common'

import type { ErrorCode } from '../constants/error-codes'

export class AppException extends HttpException {
  readonly codeError: ErrorCode

  constructor(statusCode: number, codeError: ErrorCode, message: string) {
    super({ statusCode, codeError, message }, statusCode)
    this.codeError = codeError
  }
}
