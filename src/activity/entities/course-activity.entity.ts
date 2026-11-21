import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

/** Rolling activity of one student in one published course. */
@Entity({ name: 'course_activity' })
@Index('course_activity_user_course_unique', ['userId', 'courseId'], {
  unique: true,
})
@Index('course_activity_course_idx', ['courseId'])
export class CourseActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string

  @Column({ name: 'first_opened_at', type: 'timestamptz', nullable: true })
  firstOpenedAt!: Date | null

  @Column({ name: 'last_opened_at', type: 'timestamptz', nullable: true })
  lastOpenedAt!: Date | null

  @Column({ type: 'int', default: 0 })
  visits!: number

  @Column({ name: 'total_time_seconds', type: 'int', default: 0 })
  totalTimeSeconds!: number

  @Column({ name: 'lessons_total', type: 'int', default: 0 })
  lessonsTotal!: number

  @Column({ name: 'lessons_completed', type: 'int', default: 0 })
  lessonsCompleted!: number

  @Column({ name: 'exercises_attempted', type: 'int', default: 0 })
  exercisesAttempted!: number

  @Column({ name: 'exercises_correct', type: 'int', default: 0 })
  exercisesCorrect!: number

  @Column({ name: 'progress_percent', type: 'smallint', default: 0 })
  progressPercent!: number

  @Column({
    name: 'last_module_id',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  lastModuleId!: string | null

  @Column({
    name: 'last_lesson_id',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  lastLessonId!: string | null

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
