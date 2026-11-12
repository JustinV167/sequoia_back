import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { UserRole } from './enums/user-role.enum'
import { UserStatus } from './enums/user-status.enum'

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index('users_email_unique', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    array: true,
  })
  roles!: UserRole[]

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.Active,
  })
  status!: UserStatus

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
