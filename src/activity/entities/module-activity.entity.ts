import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

/** Rolling activity of one student in one module of a course. */
@Entity({ name: 'module_activity' })
@Index(
  'module_activity_user_course_module_unique',
  ['userId', 'courseId', 'moduleId'],
  { unique: true },
)
@Index('module_activity_course_idx', ['courseId'])
export class ModuleActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string

  @Column({ name: 'module_id', type: 'varchar', length: 200 })
  moduleId!: string

  @Column({
    name: 'module_title',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  moduleTitle!: string | null

  @Column({ name: 'first_viewed_at', type: 'timestamptz', nullable: true })
  firstViewedAt!: Date | null

  @Column({ name: 'last_viewed_at', type: 'timestamptz', nullable: true })
  lastViewedAt!: Date | null

  @Column({ type: 'int', default: 0 })
  visits!: number

  @Column({ name: 'total_time_seconds', type: 'int', default: 0 })
  totalTimeSeconds!: number

  @Column({ name: 'lessons_total', type: 'int', default: 0 })
  lessonsTotal!: number

  @Column({ name: 'lessons_completed', type: 'int', default: 0 })
  lessonsCompleted!: number

  @Column({ name: 'progress_percent', type: 'smallint', default: 0 })
  progressPercent!: number

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
