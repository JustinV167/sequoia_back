import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

/** Rolling activity of one student in one exercise of a course. */
@Entity({ name: 'exercise_activity' })
@Index(
  'exercise_activity_user_course_exercise_unique',
  ['userId', 'courseId', 'exerciseId'],
  { unique: true },
)
@Index('exercise_activity_course_idx', ['courseId'])
@Index('exercise_activity_lesson_idx', ['courseId', 'lessonId'])
export class ExerciseActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string

  @Column({ name: 'module_id', type: 'varchar', length: 200, nullable: true })
  moduleId!: string | null

  @Column({ name: 'lesson_id', type: 'varchar', length: 200, nullable: true })
  lessonId!: string | null

  @Column({ name: 'exercise_id', type: 'varchar', length: 200 })
  exerciseId!: string

  @Column({
    name: 'exercise_type',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  exerciseType!: string | null

  @Column({ type: 'text', nullable: true })
  prompt!: string | null

  @Column({ name: 'first_started_at', type: 'timestamptz', nullable: true })
  firstStartedAt!: Date | null

  @Column({ name: 'last_started_at', type: 'timestamptz', nullable: true })
  lastStartedAt!: Date | null

  @Column({ name: 'first_attempted_at', type: 'timestamptz', nullable: true })
  firstAttemptedAt!: Date | null

  @Column({ name: 'last_attempted_at', type: 'timestamptz', nullable: true })
  lastAttemptedAt!: Date | null

  @Column({ name: 'solved_at', type: 'timestamptz', nullable: true })
  solvedAt!: Date | null

  @Column({ type: 'int', default: 0 })
  starts!: number

  @Column({ type: 'int', default: 0 })
  retries!: number

  @Column({ type: 'int', default: 0 })
  attempts!: number

  @Column({ name: 'correct_attempts', type: 'int', default: 0 })
  correctAttempts!: number

  @Column({ name: 'incorrect_attempts', type: 'int', default: 0 })
  incorrectAttempts!: number

  @Column({ name: 'review_attempts', type: 'int', default: 0 })
  reviewAttempts!: number

  @Column({
    name: 'best_score',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  bestScore!: string | null

  @Column({
    name: 'last_score',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  lastScore!: string | null

  @Column({ name: 'total_time_seconds', type: 'int', default: 0 })
  totalTimeSeconds!: number

  @Column({ name: 'last_answer', type: 'jsonb', nullable: true })
  lastAnswer!: Record<string, unknown> | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
