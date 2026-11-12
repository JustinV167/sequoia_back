import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Session } from './session.entity'

export interface CreateSessionData {
  tokenHash: string
  userId: string
  expiresAt: Date
  lastUsedAt: Date
  ipAddress: string | null
  userAgent: string | null
}

@Injectable()
export class SessionsRepository {
  constructor(
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {}

  async create(data: CreateSessionData): Promise<Session> {
    const session = this.sessions.create(data)
    return this.sessions.save(session)
  }

  async findByTokenHashWithUser(tokenHash: string): Promise<Session | null> {
    return this.sessions.findOne({
      where: { tokenHash },
      relations: { user: true },
    })
  }

  async deleteById(id: string): Promise<void> {
    await this.sessions.delete(id)
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.sessions.delete({ userId })
  }
}
