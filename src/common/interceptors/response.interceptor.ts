import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Response } from 'express'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator'
import type { ApiSuccessResponse } from '../types/api-response.types'

const DEFAULT_MESSAGES: Record<number, string> = {
  200: 'Operation successful.',
  201: 'Resource created successfully.',
  202: 'Request accepted.',
  204: 'Operation successful.',
}

function isApiSuccessResponse(value: unknown): value is ApiSuccessResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.message === 'string'
  )
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T> | ApiSuccessResponse>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | ApiSuccessResponse> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse<Response>()
        const statusCode = response.statusCode
        const message =
          this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
            context.getHandler(),
            context.getClass(),
          ]) ??
          DEFAULT_MESSAGES[statusCode] ??
          'Operation successful.'

        if (isApiSuccessResponse(data)) {
          return data
        }

        if (data === undefined || data === null) {
          return { statusCode, message }
        }

        return { statusCode, message, data }
      }),
    )
  }
}
