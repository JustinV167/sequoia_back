import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, IsNull, Repository } from 'typeorm'

import { VerificationCode } from './verification-code.entity'
import { VerificationPurpose } from './enums/verification-purpose.enum'

export interface CreateVerificationCodeData {
  email: string
  purpose: VerificationPurpose
  codeHash: string
  expiresAt: Date
}

@Injectable()
export class VerificationCodesRepository {
  constructor(
    @InjectRepository(VerificationCode)
    private readonly verificationCodes: Repository<VerificationCode>,
  ) {}

  forManager(manager: EntityManager): VerificationCodesRepository {
    return new VerificationCodesRepository(
      manager.getRepository(VerificationCode),
    )
  }

  async findLatestByEmailAndPurpose(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationCode | null> {
    return this.verificationCodes.findOne({
      where: { email, purpose },
      order: { createdAt: 'DESC' },
    })
  }

  async findLatestUnconsumed(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<VerificationCode | null> {
    return this.verificationCodes.findOne({
      where: { email, purpose, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    })
  }

  async findById(id: string): Promise<VerificationCode | null> {
    return this.verificationCodes.findOne({ where: { id } })
  }

  async findByIdForUpdate(id: string): Promise<VerificationCode | null> {
    return this.verificationCodes.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    })
  }

  async invalidateUnconsumed(
    email: string,
    purpose: VerificationPurpose,
    consumedAt: Date,
  ): Promise<void> {
    await this.verificationCodes.update(
      { email, purpose, consumedAt: IsNull() },
      { consumedAt },
    )
  }

  async create(
    data: CreateVerificationCodeData,
  ): Promise<VerificationCode> {
    const verificationCode = this.verificationCodes.create({
      ...data,
      attempts: 0,
    })

    return this.verificationCodes.save(verificationCode)
  }

  async save(verificationCode: VerificationCode): Promise<VerificationCode> {
    return this.verificationCodes.save(verificationCode)
  }

  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    await this.verificationCodes.update({ id }, { consumedAt })
  }

  async deleteById(id: string): Promise<void> {
    await this.verificationCodes.delete(id)
  }
}
