import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { User } from '../../users/user.entity'

@Entity({ name: 'sessions' })
@Index('sessions_user_id_idx', ['userId'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index('sessions_token_hash_unique', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Column({ name: 'last_used_at', type: 'timestamptz' })
  lastUsedAt!: Date

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
