import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

/** Rolling activity of one student in one lesson of a course. */
@Entity({ name: 'lesson_activity' })
@Index(
  'lesson_activity_user_course_lesson_unique',
  ['userId', 'courseId', 'lessonId'],
  { unique: true },
)
@Index('lesson_activity_course_idx', ['courseId'])
@Index('lesson_activity_module_idx', ['courseId', 'moduleId'])
export class LessonActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string

  @Column({ name: 'module_id', type: 'varchar', length: 200, nullable: true })
  moduleId!: string | null

  @Column({ name: 'lesson_id', type: 'varchar', length: 200 })
  lessonId!: string

  @Column({
    name: 'lesson_title',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  lessonTitle!: string | null

  @Column({ name: 'lesson_type', type: 'varchar', length: 32, nullable: true })
  lessonType!: string | null

  @Column({ name: 'first_viewed_at', type: 'timestamptz', nullable: true })
  firstViewedAt!: Date | null

  @Column({ name: 'last_viewed_at', type: 'timestamptz', nullable: true })
  lastViewedAt!: Date | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null

  @Column({ name: 'total_time_seconds', type: 'int', default: 0 })
  totalTimeSeconds!: number

  @Column({ type: 'int', default: 0 })
  visits!: number

  @Column({ name: 'last_position_seconds', type: 'int', nullable: true })
  lastPositionSeconds!: number | null

  @Column({ name: 'video_duration_seconds', type: 'int', nullable: true })
  videoDurationSeconds!: number | null

  @Column({ name: 'progress_percent', type: 'smallint', default: 0 })
  progressPercent!: number

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
