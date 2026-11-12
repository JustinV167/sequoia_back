import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { getSecret } from '../../config/secrets'
import { VerificationPurpose } from './enums/verification-purpose.enum'

@Injectable()
export class OtpService {
  private readonly pepper: string

  constructor(config: ConfigService) {
    this.pepper = getSecret(
      config,
      'OTP_PEPPER',
      'dev-otp-pepper-change-me',
    )
  }

  generate(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0')
  }

  hash(email: string, purpose: VerificationPurpose, code: string): string {
    return createHmac('sha256', this.pepper)
      .update(`${purpose}:${email}:${code}`)
      .digest('hex')
  }

  matches(
    storedHash: string,
    email: string,
    purpose: VerificationPurpose,
    code: string,
  ): boolean {
    const expected = Buffer.from(storedHash, 'hex')
    const actual = Buffer.from(this.hash(email, purpose, code), 'hex')

    if (expected.length !== actual.length) {
      return false
    }

    return timingSafeEqual(expected, actual)
  }
}
