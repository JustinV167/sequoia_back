import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, QueryFailedError, Repository } from 'typeorm'

import { User } from './user.entity'
import { EmailAlreadyExistsError } from './errors/email-already-exists.error'
import type { UserRole } from './enums/user-role.enum'

export type CreateUserData = Pick<
  User,
  'email' | 'passwordHash' | 'fullName' | 'roles' | 'status' | 'emailVerifiedAt'
>

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  forManager(manager: EntityManager): UsersRepository {
    return new UsersRepository(manager.getRepository(User))
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.users.count({ where: { email } })
    return count > 0
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } })
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne()
  }

  async create(data: CreateUserData): Promise<User> {
    try {
      const user = this.users.create(data)
      return await this.users.save(user)
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = (
          error as QueryFailedError & {
            driverError?: { code?: string }
          }
        ).driverError

        if (driverError?.code === '23505') {
          throw new EmailAlreadyExistsError()
        }
      }

      throw error
    }
  }

  async updateLastLogin(userId: string, loggedAt: Date): Promise<void> {
    await this.users.update({ id: userId }, { lastLoginAt: loggedAt })
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.users.update({ id: userId }, { passwordHash })
  }

  async updateRoles(userId: string, roles: UserRole[]): Promise<void> {
    await this.users.update({ id: userId }, { roles })
  }
}
