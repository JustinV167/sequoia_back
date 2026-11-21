import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { User } from '../users/user.entity'
import { CourseLevel } from './enums/course-level.enum'

/**
 * Reusable course definition. Teachers edit the template once and every
 * publication created from it reflects the same metadata and content.
 */
@Entity({ name: 'course_templates' })
@Index('course_templates_teacher_id_idx', ['teacherId'])
export class CourseTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: User

  @Column({ type: 'varchar', length: 160 })
  title!: string

  @Column({ type: 'varchar', length: 100 })
  subject!: string

  @Column({ type: 'text', default: '' })
  description!: string

  @Column({
    type: 'enum',
    enum: CourseLevel,
    enumName: 'course_level',
  })
  level!: CourseLevel

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes!: number | null

  @Column({ name: 'cover_url', type: 'varchar', length: 500, nullable: true })
  coverUrl!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
