import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { ActivityEventType } from '../enums/activity-event-type.enum'

/**
 * Append-only log of every learning interaction reported by the client.
 * The row keeps denormalised ids (module/lesson/exercise) because course
 * content lives in MongoDB and those ids must stay queryable without a join.
 */
@Entity({ name: 'activity_events' })
@Index('activity_events_event_id_unique', ['eventId'], { unique: true })
@Index('activity_events_user_occurred_idx', ['userId', 'occurredAt'])
@Index('activity_events_course_occurred_idx', ['courseId', 'occurredAt'])
@Index('activity_events_course_user_idx', ['courseId', 'userId'])
@Index('activity_events_module_idx', ['moduleId'])
@Index('activity_events_lesson_idx', ['lessonId'])
@Index('activity_events_exercise_idx', ['exerciseId'])
@Index('activity_events_type_idx', ['eventType'])
export class ActivityEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Client-generated id; unique so a retried batch is applied only once. */
  @Column({ name: 'event_id', type: 'varchar', length: 64 })
  eventId!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId!: string | null

  @Column({ name: 'course_id', type: 'uuid', nullable: true })
  courseId!: string | null

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null

  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId!: string | null

  @Column({ name: 'module_id', type: 'varchar', length: 200, nullable: true })
  moduleId!: string | null

  @Column({ name: 'lesson_id', type: 'varchar', length: 200, nullable: true })
  lessonId!: string | null

  @Column({ name: 'exercise_id', type: 'varchar', length: 200, nullable: true })
  exerciseId!: string | null

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: ActivityEventType

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null

  @Column({ name: 'position_seconds', type: 'int', nullable: true })
  positionSeconds!: number | null

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number | null

  @Column({
    name: 'progress_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  progressPercent!: string | null

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  score!: string | null

  @Column({ name: 'attempt_number', type: 'int', nullable: true })
  attemptNumber!: number | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null
}
