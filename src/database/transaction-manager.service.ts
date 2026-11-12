import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

import { UsersRepository } from '../users/users.repository'
import { VerificationCodesRepository } from '../auth/verification/verification-codes.repository'

export interface TransactionRepositories {
  users: UsersRepository
  verificationCodes: VerificationCodesRepository
}

@Injectable()
export class TransactionManager {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersRepository,
    private readonly verificationCodes: VerificationCodesRepository,
  ) {}

  async run<T>(
    work: (repositories: TransactionRepositories) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work({
        users: this.users.forManager(manager),
        verificationCodes: this.verificationCodes.forManager(manager),
      }),
    )
  }
}
