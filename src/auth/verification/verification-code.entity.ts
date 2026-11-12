import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { VerificationPurpose } from './enums/verification-purpose.enum'

@Entity({ name: 'verification_codes' })
@Index('verification_codes_lookup_idx', ['email', 'purpose', 'createdAt'])
@Index('verification_codes_expires_at_idx', ['expiresAt'])
export class VerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 255 })
  email!: string

  @Column({
    type: 'enum',
    enum: VerificationPurpose,
    enumName: 'verification_purpose',
  })
  purpose!: VerificationPurpose

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash!: string

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Column({ type: 'int', default: 0 })
  attempts!: number

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
