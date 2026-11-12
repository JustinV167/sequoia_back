import { Injectable } from '@nestjs/common'
import {
  Algorithm,
  hash as argonHash,
  verify as argonVerify,
} from '@node-rs/argon2'

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

@Injectable()
export class PasswordService {
  private readonly dummyHashPromise: Promise<string>

  constructor() {
    this.dummyHashPromise = argonHash(
      'sequoia-dummy-password-for-timing',
      ARGON2_OPTIONS,
    )
  }

  hash(password: string): Promise<string> {
    return argonHash(password, ARGON2_OPTIONS)
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await argonVerify(passwordHash, password)
    } catch {
      return false
    }
  }

  async consumeDummy(password: string): Promise<void> {
    try {
      await argonVerify(await this.dummyHashPromise, password)
    } catch {
      // Dummy verification only exists to reduce timing differences.
    }
  }
}
