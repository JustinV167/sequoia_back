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
import { CourseTemplate } from './course-template.entity'
import { CourseLevel } from './enums/course-level.enum'
import { CourseStatus } from './enums/course-status.enum'

@Entity({ name: 'courses' })
@Index('courses_teacher_id_idx', ['teacherId'])
@Index('courses_status_idx', ['status'])
@Index('courses_template_id_idx', ['templateId'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId!: string

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: User

  /**
   * Template this publication was created from. Nullable only to tolerate
   * rows created before the template/publication split.
   */
  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null

  @ManyToOne(() => CourseTemplate, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'template_id' })
  template!: CourseTemplate | null

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

  /**
   * True when the publication uses a custom title. Template title edits only
   * propagate to publications that still use the default title.
   */
  @Column({ name: 'title_overridden', type: 'boolean', default: false })
  titleOverridden!: boolean

  @Column({
    type: 'enum',
    enum: CourseStatus,
    enumName: 'course_status',
    default: CourseStatus.Draft,
  })
  status!: CourseStatus

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
