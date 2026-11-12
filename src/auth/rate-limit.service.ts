import { Injectable } from '@nestjs/common'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>()

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now()
    const bucket = this.buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      this.cleanup(now)
      return { allowed: true, retryAfterSeconds: 0 }
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1000),
        ),
      }
    }

    bucket.count += 1
    return { allowed: true, retryAfterSeconds: 0 }
  }

  consumeOrThrow(
    key: string,
    limit: number,
    windowMs: number,
    message = 'Too many attempts. Try again later.',
  ): void {
    const result = this.consume(key, limit, windowMs)

    if (!result.allowed) {
      throw new AppException(
        429,
        ErrorCodes.TooManyRequests,
        `${message} Wait ${result.retryAfterSeconds} seconds.`,
      )
    }
  }

  private cleanup(now: number): void {
    if (this.buckets.size < 5000) {
      return
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key)
      }
    }
  }
}
