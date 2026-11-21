import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { QuizAttemptStatus } from './quiz-status.enum'

/**
 * One student attempt at one quiz lesson. The server owns `started_at` and
 * `expires_at`; the row also keeps the latest autosaved answers so a reload,
 * tab close or power outage never loses the student's work.
 */
@Entity({ name: 'quiz_attempts' })
@Index(
  'quiz_attempts_student_course_lesson_attempt_unique',
  ['studentId', 'courseId', 'lessonId', 'attemptNumber'],
  { unique: true },
)
@Index('quiz_attempts_course_idx', ['courseId'])
@Index('quiz_attempts_course_student_idx', ['courseId', 'studentId'])
@Index('quiz_attempts_active_idx', [
  'studentId',
  'courseId',
  'lessonId',
  'status',
])
export class QuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string

  @Column({ name: 'lesson_id', type: 'varchar', length: 200 })
  lessonId!: string

  @Column({ name: 'quiz_title', type: 'varchar', length: 200, nullable: true })
  quizTitle!: string | null

  @Column({
    type: 'varchar',
    length: 20,
    default: QuizAttemptStatus.InProgress,
  })
  status!: QuizAttemptStatus

  @Column({ name: 'attempt_number', type: 'int', default: 1 })
  attemptNumber!: number

  @Column({ name: 'question_count', type: 'int', default: 0 })
  questionCount!: number

  @Column({ name: 'time_limit_minutes', type: 'int', default: 0 })
  timeLimitMinutes!: number

  @Column({ name: 'pass_score', type: 'smallint', default: 60 })
  passScore!: number

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  answers!: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  results!: unknown[] | null

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  score!: string | null

  @Column({ name: 'correct_count', type: 'int', default: 0 })
  correctCount!: number

  @Column({ name: 'incorrect_count', type: 'int', default: 0 })
  incorrectCount!: number

  @Column({ name: 'review_count', type: 'int', default: 0 })
  reviewCount!: number

  @Column({ type: 'boolean', nullable: true })
  passed!: boolean | null

  @Column({ name: 'time_spent_seconds', type: 'int', default: 0 })
  timeSpentSeconds!: number

  @Column({ name: 'focus_lost_count', type: 'int', default: 0 })
  focusLostCount!: number

  @Column({ name: 'tab_hidden_seconds', type: 'int', default: 0 })
  tabHiddenSeconds!: number

  @Column({ name: 'paste_count', type: 'int', default: 0 })
  pasteCount!: number

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
