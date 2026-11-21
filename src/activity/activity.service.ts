import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, Repository } from 'typeorm'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import type { ClientMeta } from '../common/utils/client-meta'
import { Course } from '../courses/course.entity'
import { CourseRepository } from '../courses/course.repository'
import { Enrollment } from '../courses/enrollments/enrollment.entity'
import { EnrollmentRepository } from '../courses/enrollments/enrollment.repository'
import { EnrollmentStatus } from '../courses/enrollments/enums/enrollment-status.enum'
import { CourseStatus } from '../courses/enums/course-status.enum'
import { CourseContentRepository } from '../courses/templates/course-content.repository'
import { assertTeacher } from '../courses/utils/role-guards'
import type { PublicUser } from '../users/types/public-user.interface'
import {
  clamp,
  countLessons,
  firstReturnedRow,
  groupBy,
  lessonsPerModule,
  metaNumber,
  metaString,
  resolveOccurredAt,
  returnedRows,
  sanitizeMetadata,
  toNumber,
  truncate,
} from './activity.utils'
import type {
  ActivityEventDto,
  ListActivityEventsQueryDto,
  TrackEventsDto,
} from './dto/activity.dto'
import { ActivityEvent } from './entities/activity-event.entity'
import { CourseActivity } from './entities/course-activity.entity'
import { ExerciseActivity } from './entities/exercise-activity.entity'
import { LessonActivity } from './entities/lesson-activity.entity'
import { ModuleActivity } from './entities/module-activity.entity'
import { ActivityEventType } from './enums/activity-event-type.enum'
import type {
  ActivityDayResponse,
  ActivityEventResponse,
  CourseActivityBreakdownResponse,
  CourseActivityResponse,
  CourseActivitySummaryResponse,
  CourseStudentActivityResponse,
  ExerciseActivityResponse,
  ExerciseBreakdownItem,
  LessonActivityResponse,
  LessonBreakdownItem,
  ModuleActivityResponse,
  ModuleBreakdownItem,
  MyCourseActivityResponse,
  StudentActivityDetailResponse,
  TrackEventsResponse,
} from './types/activity-response.interface'

interface CourseContext {
  course: Course
  enrollment: Enrollment
  lessonsTotal: number
  moduleTotals: Map<string, number>
}

interface EventRow {
  eventId: string
  userId: string
  sessionId: string | null
  courseId: string
  templateId: string | null
  enrollmentId: string
  moduleId: string | null
  lessonId: string | null
  exerciseId: string | null
  eventType: ActivityEventType
  occurredAt: Date
  durationMs: number | null
  positionSeconds: number | null
  durationSeconds: number | null
  progressPercent: number | null
  score: number | null
  attemptNumber: number | null
  metadata: Record<string, unknown>
  ipAddress: string | null
  userAgent: string | null
}

interface AggregateStats {
  completed: number
  attempts: number
  correct: number
  lastCompletedAt: Date | null
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityEvent)
    private readonly events: Repository<ActivityEvent>,
    @InjectRepository(CourseActivity)
    private readonly courseActivity: Repository<CourseActivity>,
    @InjectRepository(ModuleActivity)
    private readonly moduleActivity: Repository<ModuleActivity>,
    @InjectRepository(LessonActivity)
    private readonly lessonActivity: Repository<LessonActivity>,
    @InjectRepository(ExerciseActivity)
    private readonly exerciseActivity: Repository<ExerciseActivity>,
    private readonly dataSource: DataSource,
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly contents: CourseContentRepository,
  ) {}

  /**
   * Stores a batch of interactions. Events are deduplicated by their client
   * id, and only the newly stored ones update the rolling aggregates, so a
   * retried request (common on `pagehide`) can never double count time.
   */
  async track(
    user: PublicUser,
    sessionId: string | undefined,
    dto: TrackEventsDto,
    client: ClientMeta,
  ): Promise<TrackEventsResponse> {
    const courseIds = [...new Set(dto.events.map((event) => event.courseId))]
    const contexts = new Map<string, CourseContext>()

    for (const courseId of courseIds) {
      contexts.set(courseId, await this.resolveCourseContext(courseId, user))
    }

    const now = new Date()
    const rows = dto.events.map((event) =>
      this.toRow(event, user, sessionId, contexts.get(event.courseId)!, now, client),
    )

    let accepted: EventRow[] = []

    await this.dataSource.transaction(async (manager) => {
      const values: unknown[] = []
      const tuples = rows.map((row, index) => {
        const base = index * 20
        values.push(
          row.eventId,
          row.userId,
          row.sessionId,
          row.courseId,
          row.templateId,
          row.enrollmentId,
          row.moduleId,
          row.lessonId,
          row.exerciseId,
          row.eventType,
          row.occurredAt,
          row.durationMs,
          row.positionSeconds,
          row.durationSeconds,
          row.progressPercent,
          row.score,
          row.attemptNumber,
          JSON.stringify(row.metadata),
          row.ipAddress,
          row.userAgent,
        )

        const placeholders = Array.from(
          { length: 20 },
          (_, offset) => `$${base + offset + 1}`,
        )
        placeholders[17] = `${placeholders[17]}::jsonb`

        return `(${placeholders.join(', ')})`
      })

      const inserted = await manager.query(
        `
          INSERT INTO "activity_events" (
            "event_id", "user_id", "session_id", "course_id",
            "template_id", "enrollment_id", "module_id", "lesson_id",
            "exercise_id", "event_type", "occurred_at", "duration_ms",
            "position_seconds", "duration_seconds", "progress_percent",
            "score", "attempt_number", "metadata", "ip_address", "user_agent"
          )
          VALUES ${tuples.join(', ')}
          ON CONFLICT ("event_id") DO NOTHING
          RETURNING "event_id"
        `,
        values,
      )

      const insertedIds = new Set(
        returnedRows<{ event_id: string }>(inserted).map(
          (item) => item.event_id,
        ),
      )
      accepted = rows.filter((row) => insertedIds.has(row.eventId))

      for (const [courseId, courseEvents] of groupBy(
        accepted,
        (event) => event.courseId,
      )) {
        await this.applyAggregates(
          manager,
          contexts.get(courseId)!,
          courseEvents,
        )
      }
    })

    return {
      accepted: accepted.length,
      duplicates: dto.events.length - accepted.length,
    }
  }

  /** Detailed activity of the current user inside one course. */
  async getMyCourseActivity(
    user: PublicUser,
    courseId: string,
  ): Promise<MyCourseActivityResponse> {
    await this.resolveCourseContext(courseId, user)

    return this.loadUserCourseActivity(user.id, courseId)
  }

  /** Detailed activity of one student, reserved for the course owner. */
  async getStudentCourseActivity(
    user: PublicUser,
    courseId: string,
    studentId: string,
  ): Promise<StudentActivityDetailResponse> {
    await this.assertCourseOwner(courseId, user)

    const [student] = await this.dataSource.query<
      { id: string; fullName: string; email: string }[]
    >(
      `
        SELECT
          student.id AS "id",
          student.full_name AS "fullName",
          student.email AS "email"
        FROM "enrollments" AS enrollment
        INNER JOIN "users" AS student ON student.id = enrollment.student_id
        WHERE enrollment.course_id = $1
          AND enrollment.student_id = $2
      `,
      [courseId, studentId],
    )

    if (!student) {
      throw new AppException(
        404,
        ErrorCodes.EnrollmentNotFound,
        'This student is not enrolled in the course.',
      )
    }

    const activity = await this.loadUserCourseActivity(studentId, courseId)

    return { ...activity, student }
  }

  private async loadUserCourseActivity(
    userId: string,
    courseId: string,
  ): Promise<MyCourseActivityResponse> {
    const [course, modules, lessons, exercises, recentEvents, timeline] =
      await Promise.all([
        this.courseActivity.findOne({
          where: { userId, courseId },
        }),
        this.moduleActivity.find({
          where: { userId, courseId },
          order: { firstViewedAt: 'ASC' },
        }),
        this.lessonActivity.find({
          where: { userId, courseId },
          order: { firstViewedAt: 'ASC' },
        }),
        this.exerciseActivity.find({
          where: { userId, courseId },
          order: { lastAttemptedAt: 'DESC' },
        }),
        this.events.find({
          where: { userId, courseId },
          order: { occurredAt: 'DESC' },
          take: 100,
        }),
        this.loadActivityTimeline(userId, courseId),
      ])

    return {
      courseId,
      course: course ? this.toCourseActivityResponse(course) : null,
      modules: modules.map((item) => this.toModuleActivityResponse(item)),
      lessons: lessons.map((item) => this.toLessonActivityResponse(item)),
      exercises: exercises.map((item) =>
        this.toExerciseActivityResponse(item),
      ),
      recentEvents: recentEvents.map((item) => this.toEventResponse(item)),
      timeline,
    }
  }

  /** Daily series used by the student charts. */
  private async loadActivityTimeline(
    userId: string,
    courseId: string,
  ): Promise<ActivityDayResponse[]> {
    const rows = await this.dataSource.query<ActivityDayResponse[]>(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', occurred_at), 'YYYY-MM-DD') AS "date",
          COUNT(*)::int AS "events",
          COALESCE(
            ROUND(
              SUM(
                CASE WHEN event_type = 'lesson_time' THEN duration_ms ELSE 0 END
              ) / 1000.0
            ),
            0
          )::int AS "timeSeconds",
          (COUNT(DISTINCT CASE
            WHEN event_type = 'lesson_completed' THEN lesson_id
          END))::int AS "lessonsCompleted",
          (COUNT(DISTINCT CASE
            WHEN event_type = 'exercise_answered' THEN exercise_id
          END))::int AS "exercisesAnswered"
        FROM "activity_events"
        WHERE course_id = $1 AND user_id = $2
        GROUP BY DATE_TRUNC('day', occurred_at)
        ORDER BY DATE_TRUNC('day', occurred_at) ASC
      `,
      [courseId, userId],
    )

    return rows.map((row) => ({
      date: row.date,
      events: Number(row.events),
      timeSeconds: Number(row.timeSeconds),
      lessonsCompleted: Number(row.lessonsCompleted),
      exercisesAnswered: Number(row.exercisesAnswered),
    }))
  }

  /** Per-student aggregates for the teacher dashboard. */
  async getCourseStudents(
    user: PublicUser,
    courseId: string,
  ): Promise<CourseStudentActivityResponse[]> {
    await this.assertCourseOwner(courseId, user)

    const rows = await this.dataSource.query<
      {
        studentId: string
        fullName: string
        email: string
        enrollmentProgressPercent: number
        status: string
        enrolledAt: Date
        firstOpenedAt: Date | null
        lastOpenedAt: Date | null
        visits: number
        totalTimeSeconds: number
        lessonsTotal: number
        lessonsCompleted: number
        exercisesAttempted: number
        exercisesCorrect: number
        progressPercent: number
        completedAt: Date | null
        eventsCount: number
      }[]
    >(
      `
        SELECT
          enrollment.student_id AS "studentId",
          student.full_name AS "fullName",
          student.email AS "email",
          enrollment.progress_percent AS "enrollmentProgressPercent",
          enrollment.status AS "status",
          enrollment.enrolled_at AS "enrolledAt",
          activity.first_opened_at AS "firstOpenedAt",
          activity.last_opened_at AS "lastOpenedAt",
          COALESCE(activity.visits, 0) AS "visits",
          COALESCE(activity.total_time_seconds, 0) AS "totalTimeSeconds",
          COALESCE(activity.lessons_total, 0) AS "lessonsTotal",
          COALESCE(activity.lessons_completed, 0) AS "lessonsCompleted",
          COALESCE(activity.exercises_attempted, 0) AS "exercisesAttempted",
          COALESCE(activity.exercises_correct, 0) AS "exercisesCorrect",
          COALESCE(activity.progress_percent, 0) AS "progressPercent",
          activity.completed_at AS "completedAt",
          COALESCE(events.events_count, 0) AS "eventsCount"
        FROM "enrollments" AS enrollment
        INNER JOIN "users" AS student ON student.id = enrollment.student_id
        LEFT JOIN "course_activity" AS activity
          ON activity.user_id = enrollment.student_id
         AND activity.course_id = enrollment.course_id
        LEFT JOIN (
          SELECT user_id, course_id, COUNT(*)::int AS events_count
          FROM "activity_events"
          WHERE course_id = $1
          GROUP BY user_id, course_id
        ) AS events
          ON events.user_id = enrollment.student_id
         AND events.course_id = enrollment.course_id
        WHERE enrollment.course_id = $1
        ORDER BY activity.last_opened_at DESC NULLS LAST, student.full_name ASC
      `,
      [courseId],
    )

    return rows.map((row) => ({
      ...row,
      enrollmentProgressPercent: Number(row.enrollmentProgressPercent),
      visits: Number(row.visits),
      totalTimeSeconds: Number(row.totalTimeSeconds),
      lessonsTotal: Number(row.lessonsTotal),
      lessonsCompleted: Number(row.lessonsCompleted),
      exercisesAttempted: Number(row.exercisesAttempted),
      exercisesCorrect: Number(row.exercisesCorrect),
      progressPercent: Number(row.progressPercent),
      eventsCount: Number(row.eventsCount),
    }))
  }

  /** Aggregated KPIs of a course for the teacher dashboard. */
  async getCourseSummary(
    user: PublicUser,
    courseId: string,
  ): Promise<CourseActivitySummaryResponse> {
    await this.assertCourseOwner(courseId, user)

    const [row] = await this.dataSource.query<
      {
        enrolledStudents: number
        activeStudents: number
        visits: number
        totalTimeSeconds: number
        averageTimeSeconds: number
        lessonsCompleted: number
        exercisesAttempted: number
        exercisesCorrect: number
        studentsCompleted: number
        lastActivityAt: Date | null
      }[]
    >(
      `
        SELECT
          COUNT(DISTINCT enrollment.student_id)::int AS "enrolledStudents",
          COUNT(DISTINCT activity.user_id)::int AS "activeStudents",
          COALESCE(SUM(activity.visits), 0)::int AS "visits",
          COALESCE(SUM(activity.total_time_seconds), 0)::int AS "totalTimeSeconds",
          COALESCE(
            ROUND(AVG(activity.total_time_seconds) FILTER (WHERE activity.id IS NOT NULL)),
            0
          )::int AS "averageTimeSeconds",
          COALESCE(SUM(activity.lessons_completed), 0)::int AS "lessonsCompleted",
          COALESCE(SUM(activity.exercises_attempted), 0)::int AS "exercisesAttempted",
          COALESCE(SUM(activity.exercises_correct), 0)::int AS "exercisesCorrect",
          (COUNT(*) FILTER (WHERE activity.completed_at IS NOT NULL))::int
            AS "studentsCompleted",
          MAX(activity.last_opened_at) AS "lastActivityAt"
        FROM "enrollments" AS enrollment
        LEFT JOIN "course_activity" AS activity
          ON activity.user_id = enrollment.student_id
         AND activity.course_id = enrollment.course_id
        WHERE enrollment.course_id = $1
      `,
      [courseId],
    )

    return {
      courseId,
      enrolledStudents: Number(row?.enrolledStudents ?? 0),
      activeStudents: Number(row?.activeStudents ?? 0),
      visits: Number(row?.visits ?? 0),
      totalTimeSeconds: Number(row?.totalTimeSeconds ?? 0),
      averageTimeSeconds: Number(row?.averageTimeSeconds ?? 0),
      lessonsCompleted: Number(row?.lessonsCompleted ?? 0),
      exercisesAttempted: Number(row?.exercisesAttempted ?? 0),
      exercisesCorrect: Number(row?.exercisesCorrect ?? 0),
      studentsCompleted: Number(row?.studentsCompleted ?? 0),
      lastActivityAt: row?.lastActivityAt ?? null,
    }
  }

  /** Module, lesson and exercise performance of the whole course. */
  async getCourseBreakdown(
    user: PublicUser,
    courseId: string,
  ): Promise<CourseActivityBreakdownResponse> {
    await this.assertCourseOwner(courseId, user)

    const [modules, lessons, exercises] = await Promise.all([
      this.dataSource.query<
        {
          moduleId: string
          moduleTitle: string | null
          students: number
          visits: number
          totalTimeSeconds: number
          averageTimeSeconds: number
          lessonsTotal: number
          lessonsCompleted: number
          averageProgress: number
          completedStudents: number
        }[]
      >(
        `
          SELECT
            module_id AS "moduleId",
            MAX(module_title) AS "moduleTitle",
            COUNT(DISTINCT user_id)::int AS "students",
            COALESCE(SUM(visits), 0)::int AS "visits",
            COALESCE(SUM(total_time_seconds), 0)::int AS "totalTimeSeconds",
            COALESCE(ROUND(AVG(total_time_seconds)), 0)::int
              AS "averageTimeSeconds",
            COALESCE(MAX(lessons_total), 0)::int AS "lessonsTotal",
            COALESCE(SUM(lessons_completed), 0)::int AS "lessonsCompleted",
            COALESCE(ROUND(AVG(progress_percent)), 0)::int
              AS "averageProgress",
            (COUNT(*) FILTER (WHERE progress_percent >= 100))::int
              AS "completedStudents"
          FROM "module_activity"
          WHERE course_id = $1
          GROUP BY module_id
          ORDER BY MAX(module_title) NULLS LAST, module_id
        `,
        [courseId],
      ),
      this.dataSource.query<
        {
          lessonId: string
          moduleId: string | null
          lessonTitle: string | null
          lessonType: string | null
          students: number
          visits: number
          totalTimeSeconds: number
          averageTimeSeconds: number
          completedStudents: number
          averageProgress: number
        }[]
      >(
        `
          SELECT
            lesson_id AS "lessonId",
            MAX(module_id) AS "moduleId",
            MAX(lesson_title) AS "lessonTitle",
            MAX(lesson_type) AS "lessonType",
            COUNT(DISTINCT user_id)::int AS "students",
            COALESCE(SUM(visits), 0)::int AS "visits",
            COALESCE(SUM(total_time_seconds), 0)::int AS "totalTimeSeconds",
            COALESCE(ROUND(AVG(total_time_seconds)), 0)::int
              AS "averageTimeSeconds",
            (COUNT(*) FILTER (WHERE completed_at IS NOT NULL))::int
              AS "completedStudents",
            COALESCE(ROUND(AVG(progress_percent)), 0)::int
              AS "averageProgress"
          FROM "lesson_activity"
          WHERE course_id = $1
          GROUP BY lesson_id
          ORDER BY MAX(module_id) NULLS LAST, MAX(lesson_title) NULLS LAST,
            lesson_id
        `,
        [courseId],
      ),
      this.dataSource.query<
        {
          exerciseId: string
          moduleId: string | null
          lessonId: string | null
          exerciseType: string | null
          prompt: string | null
          students: number
          attempts: number
          correctAttempts: number
          solvedStudents: number
          averageTimeSeconds: number
        }[]
      >(
        `
          SELECT
            exercise_id AS "exerciseId",
            MAX(module_id) AS "moduleId",
            MAX(lesson_id) AS "lessonId",
            MAX(exercise_type) AS "exerciseType",
            MAX(prompt) AS "prompt",
            COUNT(DISTINCT user_id)::int AS "students",
            COALESCE(SUM(attempts), 0)::int AS "attempts",
            COALESCE(SUM(correct_attempts), 0)::int AS "correctAttempts",
            (COUNT(*) FILTER (WHERE solved_at IS NOT NULL))::int
              AS "solvedStudents",
            COALESCE(ROUND(AVG(total_time_seconds)), 0)::int
              AS "averageTimeSeconds"
          FROM "exercise_activity"
          WHERE course_id = $1
          GROUP BY exercise_id
          ORDER BY MAX(lesson_id) NULLS LAST, exercise_id
        `,
        [courseId],
      ),
    ])

    return {
      courseId,
      modules: modules.map((item) => this.toModuleBreakdown(item)),
      lessons: lessons.map((item) => this.toLessonBreakdown(item)),
      exercises: exercises.map((item) => this.toExerciseBreakdown(item)),
    }
  }

  /** Raw event log, filterable and paginated. Teacher-only. */
  async getCourseEvents(
    user: PublicUser,
    courseId: string,
    query: ListActivityEventsQueryDto,
  ): Promise<ActivityEventResponse[]> {
    await this.assertCourseOwner(courseId, user)

    const limit = clamp(query.limit ?? 100, 1, 200)
    const builder = this.events
      .createQueryBuilder('event')
      .where('event.courseId = :courseId', { courseId })
      .orderBy('event.occurredAt', 'DESC')
      .take(limit)
      .skip(query.offset ?? 0)

    if (query.studentId) {
      builder.andWhere('event.userId = :studentId', {
        studentId: query.studentId,
      })
    }
    if (query.moduleId) {
      builder.andWhere('event.moduleId = :moduleId', {
        moduleId: query.moduleId,
      })
    }
    if (query.lessonId) {
      builder.andWhere('event.lessonId = :lessonId', {
        lessonId: query.lessonId,
      })
    }
    if (query.exerciseId) {
      builder.andWhere('event.exerciseId = :exerciseId', {
        exerciseId: query.exerciseId,
      })
    }
    if (query.type) {
      builder.andWhere('event.eventType = :type', { type: query.type })
    }

    const events = await builder.getMany()
    return events.map((event) => this.toEventResponse(event))
  }

  private async resolveCourseContext(
    courseId: string,
    user: PublicUser,
  ): Promise<CourseContext> {
    const course = await this.courses.findById(courseId)

    if (!course) {
      throw new AppException(
        404,
        ErrorCodes.CourseNotFound,
        'Course not found.',
      )
    }

    const enrollment = await this.enrollments.findByCourseAndStudent(
      courseId,
      user.id,
    )

    if (!enrollment) {
      throw new AppException(
        403,
        ErrorCodes.ActivityNotEnrolled,
        'Enroll in the course before recording its activity.',
      )
    }

    if (
      course.status !== CourseStatus.Published &&
      course.teacherId !== user.id
    ) {
      throw new AppException(
        404,
        ErrorCodes.CourseNotFound,
        'Course not found.',
      )
    }

    const content = await this.contents.findByTemplateId(
      course.templateId ?? course.id,
    )

    return {
      course,
      enrollment,
      lessonsTotal: countLessons(content?.modules),
      moduleTotals: lessonsPerModule(content?.modules),
    }
  }

  private async assertCourseOwner(
    courseId: string,
    user: PublicUser,
  ): Promise<Course> {
    assertTeacher(user)

    const course = await this.courses.findById(courseId)

    if (!course) {
      throw new AppException(
        404,
        ErrorCodes.CourseNotFound,
        'Course not found.',
      )
    }

    if (course.teacherId !== user.id) {
      throw new AppException(
        403,
        ErrorCodes.CourseNotOwner,
        'You do not own this course.',
      )
    }

    return course
  }

  private toRow(
    event: ActivityEventDto,
    user: PublicUser,
    sessionId: string | undefined,
    context: CourseContext,
    now: Date,
    client: ClientMeta,
  ): EventRow {
    return {
      eventId: truncate(event.eventId, 64) ?? randomUUID(),
      userId: user.id,
      sessionId: sessionId ?? null,
      courseId: event.courseId,
      templateId: context.course.templateId ?? context.course.id,
      enrollmentId: context.enrollment.id,
      moduleId: truncate(event.moduleId, 200),
      lessonId: truncate(event.lessonId, 200),
      exerciseId: truncate(event.exerciseId, 200),
      eventType: event.type,
      occurredAt: resolveOccurredAt(event.occurredAt, now),
      durationMs: event.durationMs ?? null,
      positionSeconds: event.positionSeconds ?? null,
      durationSeconds: event.durationSeconds ?? null,
      progressPercent: event.progressPercent ?? null,
      score: event.score ?? null,
      attemptNumber: event.attemptNumber ?? null,
      metadata: sanitizeMetadata(event.metadata),
      ipAddress: truncate(client.ipAddress, 64),
      userAgent: truncate(client.userAgent, 512),
    }
  }

  /**
   * Updates the four aggregate layers from a batch that belongs to one course.
   * Each layer is a single upsert per affected entity, followed by a recount
   * of completed lessons so progress never relies on client arithmetic.
   */
  private async applyAggregates(
    manager: EntityManager,
    context: CourseContext,
    events: EventRow[],
  ): Promise<void> {
    const ordered = [...events].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    )
    const latest = ordered[ordered.length - 1]
    const courseTime = sumSeconds(ordered, ActivityEventType.LessonTime)
    const visits = ordered.filter(
      (event) => event.eventType === ActivityEventType.CourseOpened,
    ).length

    await manager.query(
      `
        INSERT INTO "course_activity" (
          "user_id", "course_id", "first_opened_at", "last_opened_at",
          "visits", "total_time_seconds", "lessons_total",
          "last_module_id", "last_lesson_id"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("user_id", "course_id") DO UPDATE SET
          "first_opened_at" = LEAST(
            "course_activity"."first_opened_at",
            EXCLUDED."first_opened_at"
          ),
          "last_opened_at" = GREATEST(
            "course_activity"."last_opened_at",
            EXCLUDED."last_opened_at"
          ),
          "visits" = "course_activity"."visits" + EXCLUDED."visits",
          "total_time_seconds" = "course_activity"."total_time_seconds"
            + EXCLUDED."total_time_seconds",
          "lessons_total" = CASE
            WHEN EXCLUDED."lessons_total" > 0 THEN EXCLUDED."lessons_total"
            ELSE "course_activity"."lessons_total"
          END,
          "last_module_id" = COALESCE(
            EXCLUDED."last_module_id",
            "course_activity"."last_module_id"
          ),
          "last_lesson_id" = COALESCE(
            EXCLUDED."last_lesson_id",
            "course_activity"."last_lesson_id"
          ),
          "updated_at" = now()
      `,
      [
        ordered[0].userId,
        ordered[0].courseId,
        ordered[0].occurredAt,
        latest.occurredAt,
        visits,
        courseTime,
        context.lessonsTotal,
        lastValue(ordered, (event) => event.moduleId),
        lastValue(ordered, (event) => event.lessonId),
      ],
    )

    const moduleEvents = groupBy(ordered, (event) => event.moduleId)
    for (const [moduleId, eventsOfModule] of moduleEvents) {
      await this.upsertModule(manager, context, moduleId, eventsOfModule)
    }

    const lessonEvents = groupBy(ordered, (event) => event.lessonId)
    for (const [lessonId, eventsOfLesson] of lessonEvents) {
      await this.upsertLesson(manager, eventsOfLesson, lessonId)
    }

    const exerciseEvents = groupBy(ordered, (event) => event.exerciseId)
    for (const [exerciseId, eventsOfExercise] of exerciseEvents) {
      await this.upsertExercise(manager, eventsOfExercise, exerciseId)
    }

    await this.refreshCourseProgress(manager, context)
    await this.refreshModuleProgress(manager, context, [...moduleEvents.keys()])
  }

  private async upsertModule(
    manager: EntityManager,
    context: CourseContext,
    moduleId: string,
    events: EventRow[],
  ): Promise<void> {
    const first = events[0]
    const last = events[events.length - 1]
    const visits = events.filter(
      (event) => event.eventType === ActivityEventType.ModuleViewed,
    ).length
    const lessonsTotal =
      context.moduleTotals.get(moduleId) ??
      lastNumber(events, (event) => metaNumber(event.metadata, 'moduleLessonsTotal')) ??
      0

    await manager.query(
      `
        INSERT INTO "module_activity" (
          "user_id", "course_id", "module_id", "module_title",
          "first_viewed_at", "last_viewed_at", "visits",
          "total_time_seconds", "lessons_total"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("user_id", "course_id", "module_id") DO UPDATE SET
          "module_title" = COALESCE(
            EXCLUDED."module_title",
            "module_activity"."module_title"
          ),
          "first_viewed_at" = LEAST(
            "module_activity"."first_viewed_at",
            EXCLUDED."first_viewed_at"
          ),
          "last_viewed_at" = GREATEST(
            "module_activity"."last_viewed_at",
            EXCLUDED."last_viewed_at"
          ),
          "visits" = "module_activity"."visits" + EXCLUDED."visits",
          "total_time_seconds" = "module_activity"."total_time_seconds"
            + EXCLUDED."total_time_seconds",
          "lessons_total" = CASE
            WHEN EXCLUDED."lessons_total" > 0 THEN EXCLUDED."lessons_total"
            ELSE "module_activity"."lessons_total"
          END,
          "updated_at" = now()
      `,
      [
        first.userId,
        first.courseId,
        moduleId,
        truncate(
          lastValue(events, (event) => metaString(event.metadata, 'moduleTitle')),
          200,
        ),
        first.occurredAt,
        last.occurredAt,
        visits,
        sumSeconds(events, ActivityEventType.LessonTime),
        lessonsTotal,
      ],
    )
  }

  private async upsertLesson(
    manager: EntityManager,
    events: EventRow[],
    lessonId: string,
  ): Promise<void> {
    const first = events[0]
    const last = events[events.length - 1]
    const visits = events.filter(
      (event) => event.eventType === ActivityEventType.LessonViewed,
    ).length
    const completions = events.filter(
      (event) => event.eventType === ActivityEventType.LessonCompleted,
    )
    const completedAt = completions[0]?.occurredAt ?? null
    const lastPosition = lastNumber(events, (event) => event.positionSeconds)
    const videoDuration = lastNumber(events, (event) => event.durationSeconds)
    const moduleId = lastValue(events, (event) => event.moduleId)

    await manager.query(
      `
        INSERT INTO "lesson_activity" (
          "user_id", "course_id", "module_id", "lesson_id",
          "lesson_title", "lesson_type", "first_viewed_at", "last_viewed_at",
          "completed_at", "total_time_seconds", "visits",
          "last_position_seconds", "video_duration_seconds", "progress_percent"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT ("user_id", "course_id", "lesson_id") DO UPDATE SET
          "module_id" = COALESCE(EXCLUDED."module_id", "lesson_activity"."module_id"),
          "lesson_title" = COALESCE(
            EXCLUDED."lesson_title",
            "lesson_activity"."lesson_title"
          ),
          "lesson_type" = COALESCE(
            EXCLUDED."lesson_type",
            "lesson_activity"."lesson_type"
          ),
          "first_viewed_at" = LEAST(
            "lesson_activity"."first_viewed_at",
            EXCLUDED."first_viewed_at"
          ),
          "last_viewed_at" = GREATEST(
            "lesson_activity"."last_viewed_at",
            EXCLUDED."last_viewed_at"
          ),
          "completed_at" = COALESCE(
            "lesson_activity"."completed_at",
            EXCLUDED."completed_at"
          ),
          "total_time_seconds" = "lesson_activity"."total_time_seconds"
            + EXCLUDED."total_time_seconds",
          "visits" = "lesson_activity"."visits" + EXCLUDED."visits",
          "last_position_seconds" = COALESCE(
            EXCLUDED."last_position_seconds",
            "lesson_activity"."last_position_seconds"
          ),
          "video_duration_seconds" = COALESCE(
            EXCLUDED."video_duration_seconds",
            "lesson_activity"."video_duration_seconds"
          ),
          "progress_percent" = GREATEST(
            "lesson_activity"."progress_percent",
            EXCLUDED."progress_percent"
          ),
          "updated_at" = now()
      `,
      [
        first.userId,
        first.courseId,
        moduleId,
        lessonId,
        truncate(
          lastValue(events, (event) => metaString(event.metadata, 'lessonTitle')),
          200,
        ),
        truncate(
          lastValue(events, (event) => metaString(event.metadata, 'lessonType')),
          32,
        ),
        first.occurredAt,
        last.occurredAt,
        completedAt,
        sumSeconds(events, ActivityEventType.LessonTime),
        visits,
        lastPosition,
        videoDuration,
        completedAt ? 100 : 0,
      ],
    )
  }

  private async upsertExercise(
    manager: EntityManager,
    events: EventRow[],
    exerciseId: string,
  ): Promise<void> {
    const starts = events.filter(
      (event) => event.eventType === ActivityEventType.ExerciseStarted,
    )
    const retries = events.filter(
      (event) => event.eventType === ActivityEventType.ExerciseRetried,
    )
    const answers = events.filter(
      (event) => event.eventType === ActivityEventType.ExerciseAnswered,
    )

    const first = events[0]
    const last = events[events.length - 1]
    const lastAnswer = lastValue(events, (event) =>
      event.metadata.answer === undefined ? null : event.metadata.answer,
    )
    const scoreOf = (event: EventRow) => event.score
    const bestScore = maxNumber(answers, scoreOf)
    const lastAnswered = answers[answers.length - 1]
    const solvedAt =
      answers.find((event) => event.metadata.status === 'correct')?.occurredAt ??
      null

    await manager.query(
      `
        INSERT INTO "exercise_activity" (
          "user_id", "course_id", "module_id", "lesson_id",
          "exercise_id", "exercise_type", "prompt",
          "first_started_at", "last_started_at",
          "first_attempted_at", "last_attempted_at", "solved_at",
          "starts", "retries", "attempts",
          "correct_attempts", "incorrect_attempts", "review_attempts",
          "best_score", "last_score", "total_time_seconds", "last_answer"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb
        )
        ON CONFLICT ("user_id", "course_id", "exercise_id") DO UPDATE SET
          "module_id" = COALESCE(EXCLUDED."module_id", "exercise_activity"."module_id"),
          "lesson_id" = COALESCE(EXCLUDED."lesson_id", "exercise_activity"."lesson_id"),
          "exercise_type" = COALESCE(
            EXCLUDED."exercise_type",
            "exercise_activity"."exercise_type"
          ),
          "prompt" = COALESCE(EXCLUDED."prompt", "exercise_activity"."prompt"),
          "first_started_at" = LEAST(
            "exercise_activity"."first_started_at",
            EXCLUDED."first_started_at"
          ),
          "last_started_at" = GREATEST(
            "exercise_activity"."last_started_at",
            EXCLUDED."last_started_at"
          ),
          "first_attempted_at" = LEAST(
            "exercise_activity"."first_attempted_at",
            EXCLUDED."first_attempted_at"
          ),
          "last_attempted_at" = GREATEST(
            "exercise_activity"."last_attempted_at",
            EXCLUDED."last_attempted_at"
          ),
          "solved_at" = COALESCE(
            "exercise_activity"."solved_at",
            EXCLUDED."solved_at"
          ),
          "starts" = "exercise_activity"."starts" + EXCLUDED."starts",
          "retries" = "exercise_activity"."retries" + EXCLUDED."retries",
          "attempts" = "exercise_activity"."attempts" + EXCLUDED."attempts",
          "correct_attempts" = "exercise_activity"."correct_attempts"
            + EXCLUDED."correct_attempts",
          "incorrect_attempts" = "exercise_activity"."incorrect_attempts"
            + EXCLUDED."incorrect_attempts",
          "review_attempts" = "exercise_activity"."review_attempts"
            + EXCLUDED."review_attempts",
          "best_score" = GREATEST(
            "exercise_activity"."best_score",
            EXCLUDED."best_score"
          ),
          "last_score" = COALESCE(
            EXCLUDED."last_score",
            "exercise_activity"."last_score"
          ),
          "total_time_seconds" = "exercise_activity"."total_time_seconds"
            + EXCLUDED."total_time_seconds",
          "last_answer" = COALESCE(
            EXCLUDED."last_answer",
            "exercise_activity"."last_answer"
          ),
          "updated_at" = now()
      `,
      [
        first.userId,
        first.courseId,
        lastValue(events, (event) => event.moduleId),
        lastValue(events, (event) => event.lessonId),
        exerciseId,
        truncate(
          lastValue(events, (event) => metaString(event.metadata, 'exerciseType')),
          32,
        ),
        truncate(
          lastValue(events, (event) => metaString(event.metadata, 'prompt')),
          2000,
        ),
        starts[0]?.occurredAt ?? null,
        starts[starts.length - 1]?.occurredAt ?? null,
        answers[0]?.occurredAt ?? null,
        lastAnswered?.occurredAt ?? null,
        solvedAt,
        starts.length,
        retries.length,
        answers.length,
        answers.filter((event) => event.metadata.status === 'correct').length,
        answers.filter((event) => event.metadata.status === 'incorrect').length,
        answers.filter((event) => event.metadata.status === 'review').length,
        bestScore,
        lastAnswered?.score ?? null,
        sumSeconds(events),
        lastAnswer == null ? null : JSON.stringify(lastAnswer),
      ],
    )
  }

  private async refreshCourseProgress(
    manager: EntityManager,
    context: CourseContext,
  ): Promise<void> {
    const raw = await manager.query(
      `
        UPDATE "course_activity" AS course
        SET
          "lessons_completed" = stats.completed,
          "exercises_attempted" = stats.attempts,
          "exercises_correct" = stats.correct,
          "progress_percent" = CASE
            WHEN course."lessons_total" > 0
              THEN LEAST(
                100,
                ROUND(stats.completed::numeric * 100 / course."lessons_total")
              )::smallint
            ELSE 0
          END,
          "completed_at" = CASE
            WHEN course."lessons_total" > 0
              AND stats.completed >= course."lessons_total"
              THEN COALESCE(course."completed_at", stats.last_completed_at)
            ELSE course."completed_at"
          END,
          "updated_at" = now()
        FROM (
          SELECT
            (
              SELECT COUNT(DISTINCT lesson."lesson_id")
              FROM "lesson_activity" AS lesson
              WHERE lesson."user_id" = $1
                AND lesson."course_id" = $2
                AND lesson."completed_at" IS NOT NULL
            ) AS completed,
            (
              SELECT COALESCE(SUM(exercise."attempts"), 0)
              FROM "exercise_activity" AS exercise
              WHERE exercise."user_id" = $1
                AND exercise."course_id" = $2
            ) AS attempts,
            (
              SELECT COALESCE(SUM(exercise."correct_attempts"), 0)
              FROM "exercise_activity" AS exercise
              WHERE exercise."user_id" = $1
                AND exercise."course_id" = $2
            ) AS correct,
            (
              SELECT MAX(lesson."completed_at")
              FROM "lesson_activity" AS lesson
              WHERE lesson."user_id" = $1
                AND lesson."course_id" = $2
                AND lesson."completed_at" IS NOT NULL
            ) AS last_completed_at
        ) AS stats
        WHERE course."user_id" = $1 AND course."course_id" = $2
        RETURNING course."progress_percent", course."completed_at"
      `,
      [context.enrollment.studentId, context.course.id],
    )

    // TypeORM wraps UPDATE ... RETURNING as [rows, rowCount].
    const row = firstReturnedRow<{
      progress_percent: number | string
      completed_at: Date | null
    }>(raw)

    if (!row || context.enrollment.status === EnrollmentStatus.Cancelled) return

    const progress = clamp(Math.round(toNumber(row.progress_percent) ?? 0), 0, 100)
    const completed = progress >= 100

    // Without content the total is unknown; do not clobber existing progress.
    if (context.lessonsTotal <= 0 && progress === 0) return

    await manager.getRepository(Enrollment).update(
      { id: context.enrollment.id },
      completed
        ? {
            progressPercent: progress,
            status: EnrollmentStatus.Completed,
            completedAt:
              context.enrollment.completedAt ?? row.completed_at ?? new Date(),
          }
        : { progressPercent: progress },
    )
  }

  private async refreshModuleProgress(
    manager: EntityManager,
    context: CourseContext,
    moduleIds: string[],
  ): Promise<void> {
    for (const moduleId of moduleIds) {
      await manager.query(
        `
          UPDATE "module_activity" AS ma
          SET
            "lessons_completed" = stats.completed,
            "progress_percent" = CASE
              WHEN ma."lessons_total" > 0
                THEN LEAST(
                  100,
                  ROUND(
                    stats.completed::numeric * 100 / ma."lessons_total"
                  )
                )::smallint
              ELSE 0
            END,
            "updated_at" = now()
          FROM (
            SELECT COUNT(DISTINCT lesson."lesson_id") AS completed
            FROM "lesson_activity" AS lesson
            WHERE lesson."user_id" = $1
              AND lesson."course_id" = $2
              AND lesson."module_id" = $3
              AND lesson."completed_at" IS NOT NULL
          ) AS stats
          WHERE ma."user_id" = $1
            AND ma."course_id" = $2
            AND ma."module_id" = $3
        `,
        [context.enrollment.studentId, context.course.id, moduleId],
      )
    }
  }

  private toModuleBreakdown(item: ModuleBreakdownItem): ModuleBreakdownItem {
    return {
      ...item,
      students: Number(item.students),
      visits: Number(item.visits),
      totalTimeSeconds: Number(item.totalTimeSeconds),
      averageTimeSeconds: Number(item.averageTimeSeconds),
      lessonsTotal: Number(item.lessonsTotal),
      lessonsCompleted: Number(item.lessonsCompleted),
      averageProgress: Number(item.averageProgress),
      completedStudents: Number(item.completedStudents),
    }
  }

  private toLessonBreakdown(item: LessonBreakdownItem): LessonBreakdownItem {
    return {
      ...item,
      students: Number(item.students),
      visits: Number(item.visits),
      totalTimeSeconds: Number(item.totalTimeSeconds),
      averageTimeSeconds: Number(item.averageTimeSeconds),
      completedStudents: Number(item.completedStudents),
      averageProgress: Number(item.averageProgress),
    }
  }

  private toExerciseBreakdown(
    item: ExerciseBreakdownItem,
  ): ExerciseBreakdownItem {
    return {
      ...item,
      students: Number(item.students),
      attempts: Number(item.attempts),
      correctAttempts: Number(item.correctAttempts),
      solvedStudents: Number(item.solvedStudents),
      averageTimeSeconds: Number(item.averageTimeSeconds),
    }
  }

  private toEventResponse(event: ActivityEvent): ActivityEventResponse {
    return {
      id: event.id,
      eventId: event.eventId,
      type: event.eventType,
      userId: event.userId,
      courseId: event.courseId,
      moduleId: event.moduleId,
      lessonId: event.lessonId,
      exerciseId: event.exerciseId,
      occurredAt: event.occurredAt,
      receivedAt: event.receivedAt,
      durationMs: event.durationMs,
      positionSeconds: event.positionSeconds,
      durationSeconds: event.durationSeconds,
      progressPercent: toNumber(event.progressPercent),
      score: toNumber(event.score),
      attemptNumber: event.attemptNumber,
      metadata: event.metadata,
    }
  }

  private toCourseActivityResponse(
    activity: CourseActivity,
  ): CourseActivityResponse {
    return {
      courseId: activity.courseId,
      firstOpenedAt: activity.firstOpenedAt,
      lastOpenedAt: activity.lastOpenedAt,
      visits: activity.visits,
      totalTimeSeconds: activity.totalTimeSeconds,
      lessonsTotal: activity.lessonsTotal,
      lessonsCompleted: activity.lessonsCompleted,
      exercisesAttempted: activity.exercisesAttempted,
      exercisesCorrect: activity.exercisesCorrect,
      progressPercent: activity.progressPercent,
      lastModuleId: activity.lastModuleId,
      lastLessonId: activity.lastLessonId,
      completedAt: activity.completedAt,
    }
  }

  private toModuleActivityResponse(
    activity: ModuleActivity,
  ): ModuleActivityResponse {
    return {
      moduleId: activity.moduleId,
      moduleTitle: activity.moduleTitle,
      firstViewedAt: activity.firstViewedAt,
      lastViewedAt: activity.lastViewedAt,
      visits: activity.visits,
      totalTimeSeconds: activity.totalTimeSeconds,
      lessonsTotal: activity.lessonsTotal,
      lessonsCompleted: activity.lessonsCompleted,
      progressPercent: activity.progressPercent,
    }
  }

  private toLessonActivityResponse(
    activity: LessonActivity,
  ): LessonActivityResponse {
    return {
      moduleId: activity.moduleId,
      lessonId: activity.lessonId,
      lessonTitle: activity.lessonTitle,
      lessonType: activity.lessonType,
      firstViewedAt: activity.firstViewedAt,
      lastViewedAt: activity.lastViewedAt,
      completedAt: activity.completedAt,
      totalTimeSeconds: activity.totalTimeSeconds,
      visits: activity.visits,
      lastPositionSeconds: activity.lastPositionSeconds,
      videoDurationSeconds: activity.videoDurationSeconds,
      progressPercent: activity.progressPercent,
    }
  }

  private toExerciseActivityResponse(
    activity: ExerciseActivity,
  ): ExerciseActivityResponse {
    return {
      moduleId: activity.moduleId,
      lessonId: activity.lessonId,
      exerciseId: activity.exerciseId,
      exerciseType: activity.exerciseType,
      prompt: activity.prompt,
      firstStartedAt: activity.firstStartedAt,
      lastStartedAt: activity.lastStartedAt,
      firstAttemptedAt: activity.firstAttemptedAt,
      lastAttemptedAt: activity.lastAttemptedAt,
      solvedAt: activity.solvedAt,
      starts: activity.starts,
      retries: activity.retries,
      attempts: activity.attempts,
      correctAttempts: activity.correctAttempts,
      incorrectAttempts: activity.incorrectAttempts,
      reviewAttempts: activity.reviewAttempts,
      bestScore: toNumber(activity.bestScore),
      lastScore: toNumber(activity.lastScore),
      totalTimeSeconds: activity.totalTimeSeconds,
      lastAnswer: activity.lastAnswer,
    }
  }
}

/** Seconds spent in events of one type, rounded per event. */
function sumSeconds(
  events: EventRow[],
  type?: ActivityEventType,
): number {
  return events.reduce((total, event) => {
    if (type && event.eventType !== type) return total
    if (!event.durationMs) return total
    return total + Math.round(event.durationMs / 1000)
  }, 0)
}

/** Last non-null value produced by `pick` over events ordered by time. */
function lastValue<T>(
  events: EventRow[],
  pick: (event: EventRow) => T | null | undefined,
): T | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const value = pick(events[index])
    if (value != null) return value
  }

  return null
}

function lastNumber(
  events: EventRow[],
  pick: (event: EventRow) => number | null | undefined,
): number | null {
  return lastValue(events, pick)
}

function maxNumber(
  events: EventRow[],
  pick: (event: EventRow) => number | null | undefined,
): number | null {
  let maximum: number | null = null

  for (const event of events) {
    const value = pick(event)
    if (value == null) continue
    maximum = maximum == null ? value : Math.max(maximum, value)
  }

  return maximum
}
