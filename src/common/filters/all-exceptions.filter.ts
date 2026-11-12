import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { QueryFailedError } from 'typeorm'

import { ErrorCodes, type ErrorCode } from '../constants/error-codes'
import { AppException } from '../exceptions/app.exception'
import type { ApiErrorResponse } from '../types/api-response.types'

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ErrorCodes.InvalidRequest,
  [HttpStatus.UNAUTHORIZED]: ErrorCodes.Unauthenticated,
  [HttpStatus.FORBIDDEN]: ErrorCodes.Forbidden,
  [HttpStatus.NOT_FOUND]: ErrorCodes.NotFound,
  [HttpStatus.CONFLICT]: ErrorCodes.Conflict,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCodes.InvalidRequest,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.TooManyRequests,
  [HttpStatus.BAD_GATEWAY]: ErrorCodes.BadGateway,
  [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCodes.InternalError,
}

const STATUS_TO_MESSAGE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Check the submitted data.',
  [HttpStatus.UNAUTHORIZED]: 'Sign in to continue.',
  [HttpStatus.FORBIDDEN]: 'You do not have permission to perform this action.',
  [HttpStatus.NOT_FOUND]: 'Resource not found.',
  [HttpStatus.CONFLICT]: 'Resource already exists.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'The uploaded file is too large.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many attempts. Try again later.',
  [HttpStatus.BAD_GATEWAY]: 'We could not complete the operation. Try again.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'An unexpected error occurred.',
}

function getDriverErrorCode(exception: QueryFailedError): string | undefined {
  const driverError = (exception as QueryFailedError & {
    driverError?: { code?: string }
  }).driverError

  return driverError?.code
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const response = context.getResponse<Response>()
    const request = context.getRequest<Request>()

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR
    let codeError: ErrorCode = ErrorCodes.InternalError
    let message = STATUS_TO_MESSAGE[HttpStatus.INTERNAL_SERVER_ERROR]

    if (exception instanceof AppException) {
      const body = exception.getResponse() as {
        statusCode: number
        codeError: ErrorCode
        message: string
      }
      statusCode = exception.getStatus()
      codeError = body.codeError
      message = body.message
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      codeError = STATUS_TO_CODE[statusCode] ?? ErrorCodes.InternalError
      message =
        STATUS_TO_MESSAGE[statusCode] ??
        STATUS_TO_MESSAGE[HttpStatus.INTERNAL_SERVER_ERROR]

      const body = exception.getResponse()
      if (body && typeof body === 'object') {
        const bodyCode = (body as { codeError?: unknown }).codeError
        if (typeof bodyCode === 'string') {
          codeError = bodyCode as ErrorCode
        }
      }
    } else if (exception instanceof QueryFailedError) {
      if (getDriverErrorCode(exception) === '23505') {
        statusCode = HttpStatus.CONFLICT
        codeError = ErrorCodes.EmailExist
        message = 'This email is already registered.'
      }
    } else if (exception instanceof Error && exception.name === 'MulterError') {
      const code = (exception as Error & { code?: string }).code

      statusCode = HttpStatus.BAD_REQUEST
      codeError = ErrorCodes.InvalidRequest
      message =
        code === 'LIMIT_FILE_SIZE'
          ? 'The image must be 5 MB or smaller.'
          : 'Check the uploaded image.'
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    const payload: ApiErrorResponse = { statusCode, message, codeError }
    response.status(statusCode).json(payload)
  }
}
