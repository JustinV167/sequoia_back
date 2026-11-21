import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, QueryFailedError, Repository } from 'typeorm'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import { toExerciseAnswer } from '../assessments/answer.mapper'
import {
  collectExerciseComponents,
  contentVersion,
} from '../assessments/component'
import { gradeExercise } from '../assessments/grading/grade-exercise'
import type { ExerciseAnswer } from '../assessments/grading/grading.types'
import type { ExerciseComponent } from '../assessments/grading/grading.types'
import { PreparedExerciseCache } from '../assessments/prepared-exercise.cache'
import type { GradedExerciseResponse } from '../assessments/types/assessment-response.interface'
import { Course } from '../courses/course.entity'
import { CourseRepository } from '../courses/course.repository'
import { EnrollmentRepository } from '../courses/enrollments/enrollment.repository'
import { CourseStatus } from '../courses/enums/course-status.enum'
import { CourseContentRepository } from '../courses/templates/course-content.repository'
import { assertTeacher } from '../courses/utils/role-guards'
import type { PublicUser } from '../users/types/public-user.interface'
import { QuizAttempt } from './quiz-attempt.entity'
import type { QuizProgressDto } from './quiz.dto'
import type {
  QuizAttemptStateResponse,
  QuizInfoResponse,
  QuizStatsDayResponse,
  QuizStatsQuestionResponse,
  QuizStatsResponse,
  QuizStatsStudentResponse,
} from './quiz-response.interface'
import { QuizAttemptStatus } from './quiz-status.enum'

const EMPTY_ANSWER: ExerciseAnswer = {
  optionIds: [],
  text: '',
  blanks: [],
  order: [],
  matches: {},
}

interface QuizSettings {
  timeLimitMinutes: number
  maxAttempts: number
  passScore: number
}

interface QuizContext {
  course: Course
  lessonId: string
  content: unknown
  components: Map<string, ExerciseComponent>
  settings: QuizSettings
  title: string
  templateId: string
}

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly contents: CourseContentRepository,
    private readonly cache: PreparedExerciseCache,
  ) {}

  /** Warning data shown before the timer starts. Never starts an attempt. */
  async getQuizInfo(
    user: PublicUser,
    courseId: string,
    lessonId: string,
  ): Promise<QuizInfoResponse> {
    const context = await this.resolveContext(courseId, lessonId, user)
    const active = await this.finalizeExpired(context, user.id)

    const [history, current] = await Promise.all([
      this.attempts.find({
        where: {
          studentId: user.id,
          courseId,
          lessonId,
          status: In([QuizAttemptStatus.Submitted, QuizAttemptStatus.Expired]),
        },
        order: { attemptNumber: 'DESC' },
      }),
      active ? Promise.resolve(active) : this.findActive(user.id, courseId, lessonId),
    ])

    const scores = history
      .map((attempt) => toNumber(attempt.score))
      .filter((score): score is number => score !== null)

    return {
      courseId,
      lessonId,
      title: context.title,
      questionCount: context.components.size,
      timeLimitMinutes: context.settings.timeLimitMinutes,
      maxAttempts: context.settings.maxAttempts,
      passScore: context.settings.passScore,
      attemptsUsed: history.length,
      attemptsRemaining: Math.max(
        0,
        context.settings.maxAttempts - history.length - (current ? 1 : 0),
      ),
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      lastScore: toNumber(history[0]?.score),
      passed: history.some((attempt) => attempt.passed === true),
      activeAttempt: current ? this.toState(current) : null,
      history: history.map((attempt) => this.toState(attempt)),
    }
  }

  /** Detailed quiz analytics for the course owner. */
  async getQuizStats(
    user: PublicUser,
    courseId: string,
    lessonId: string,
  ): Promise<QuizStatsResponse> {
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

    const content = await this.contents.findByTemplateId(
      course.templateId ?? course.id,
    )
    const lesson = findLesson(content?.modules, lessonId)

    if (!lesson || lesson.type !== 'quiz') {
      throw new AppException(
        404,
        ErrorCodes.QuizNotAvailable,
        'This quiz was not found.',
      )
    }

    const components = collectExerciseComponents(lesson.components)
    const settings = readQuizSettings(lesson)

    const [summaryRow] = await this.attempts.query<
      {
        students: number
        attempts: number
        passedAttempts: number
        averageScore: number
        bestScore: string | null
        worstScore: string | null
        averageTimeSeconds: number
        focusLostEvents: number
        tabHiddenSeconds: number
        pasteEvents: number
      }[]
    >(
      `
        SELECT
          COUNT(DISTINCT student_id)::int AS "students",
          COUNT(*)::int AS "attempts",
          (COUNT(*) FILTER (WHERE passed = true))::int AS "passedAttempts",
          COALESCE(ROUND(AVG(score)), 0)::int AS "averageScore",
          ROUND(MAX(score), 2) AS "bestScore",
          ROUND(MIN(score), 2) AS "worstScore",
          COALESCE(ROUND(AVG(time_spent_seconds)), 0)::int
            AS "averageTimeSeconds",
          COALESCE(SUM(focus_lost_count), 0)::int AS "focusLostEvents",
          COALESCE(SUM(tab_hidden_seconds), 0)::int AS "tabHiddenSeconds",
          COALESCE(SUM(paste_count), 0)::int AS "pasteEvents"
        FROM "quiz_attempts"
        WHERE course_id = $1
          AND lesson_id = $2
          AND status IN ('submitted', 'expired')
      `,
      [courseId, lessonId],
    )

    const studentRows = await this.attempts.query<
      QuizStatsStudentResponse[]
    >(
      `
        SELECT
          quiz.student_id AS "studentId",
          student.full_name AS "fullName",
          student.email AS "email",
          COUNT(*)::int AS "attempts",
          ROUND(MAX(quiz.score), 2) AS "bestScore",
          ROUND(AVG(quiz.score), 2) AS "averageScore",
          (ARRAY_AGG(quiz.score ORDER BY quiz.started_at DESC))[1]
            AS "lastScore",
          BOOL_OR(quiz.passed) AS "passed",
          MAX(quiz.submitted_at) AS "lastAttemptAt",
          COALESCE(SUM(quiz.time_spent_seconds), 0)::int
            AS "totalTimeSeconds",
          COALESCE(SUM(quiz.focus_lost_count), 0)::int
            AS "focusLostCount",
          COALESCE(SUM(quiz.tab_hidden_seconds), 0)::int
            AS "tabHiddenSeconds",
          COALESCE(SUM(quiz.paste_count), 0)::int AS "pasteCount"
        FROM "quiz_attempts" AS quiz
        INNER JOIN "users" AS student ON student.id = quiz.student_id
        WHERE quiz.course_id = $1
          AND quiz.lesson_id = $2
          AND quiz.status IN ('submitted', 'expired')
        GROUP BY quiz.student_id, student.full_name, student.email
        ORDER BY "bestScore" DESC NULLS LAST, student.full_name ASC
      `,
      [courseId, lessonId],
    )

    const questionRows = await this.attempts.query<
      {
        componentId: string
        answers: number
        correct: number
        incorrect: number
        review: number
        averageScore: number
      }[]
    >(
      `
        SELECT
          result->>'componentId' AS "componentId",
          COUNT(*)::int AS "answers",
          (COUNT(*) FILTER (
            WHERE result->'result'->>'status' = 'correct'
          ))::int AS "correct",
          (COUNT(*) FILTER (
            WHERE result->'result'->>'status' = 'incorrect'
          ))::int AS "incorrect",
          (COUNT(*) FILTER (
            WHERE result->'result'->>'status' = 'review'
          ))::int AS "review",
          COALESCE(
            ROUND(AVG((result->'result'->>'score')::numeric) * 100),
            0
          )::int AS "averageScore"
        FROM "quiz_attempts" AS quiz
        CROSS JOIN LATERAL jsonb_array_elements(quiz.results) AS result
        WHERE quiz.course_id = $1
          AND quiz.lesson_id = $2
          AND quiz.status IN ('submitted', 'expired')
          AND quiz.results IS NOT NULL
        GROUP BY result->>'componentId'
      `,
      [courseId, lessonId],
    )

    const dailyRows = await this.attempts.query<QuizStatsDayResponse[]>(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('day', submitted_at), 'YYYY-MM-DD') AS "date",
          COUNT(*)::int AS "attempts",
          COALESCE(ROUND(AVG(score)), 0)::int AS "averageScore"
        FROM "quiz_attempts"
        WHERE course_id = $1
          AND lesson_id = $2
          AND status IN ('submitted', 'expired')
          AND submitted_at IS NOT NULL
        GROUP BY DATE_TRUNC('day', submitted_at)
        ORDER BY DATE_TRUNC('day', submitted_at) ASC
      `,
      [courseId, lessonId],
    )

    const questionStats = new Map(
      questionRows.map((row) => [row.componentId, row] as const),
    )
    const questions: QuizStatsQuestionResponse[] = [
      ...components.values(),
    ].map((component, index) => {
      const stats = questionStats.get(component.id)
      const answers = Number(stats?.answers ?? 0)
      const correct = Number(stats?.correct ?? 0)

      return {
        componentId: component.id,
        question: component.text?.trim() || `Pregunta ${index + 1}`,
        type: component.exerciseType ?? 'multiple',
        answers,
        correct,
        incorrect: Number(stats?.incorrect ?? 0),
        review: Number(stats?.review ?? 0),
        accuracy: answers > 0 ? Math.round((correct / answers) * 100) : 0,
        averageScore: Number(stats?.averageScore ?? 0),
      }
    })

    return {
      quiz: {
        courseId,
        lessonId,
        title: asString(lesson.title) || 'Quiz',
        questionCount: components.size,
        timeLimitMinutes: settings.timeLimitMinutes,
        maxAttempts: settings.maxAttempts,
        passScore: settings.passScore,
      },
      summary: {
        students: Number(summaryRow?.students ?? 0),
        attempts: Number(summaryRow?.attempts ?? 0),
        passedAttempts: Number(summaryRow?.passedAttempts ?? 0),
        averageScore: Number(summaryRow?.averageScore ?? 0),
        bestScore: toNumber(summaryRow?.bestScore),
        worstScore: toNumber(summaryRow?.worstScore),
        averageTimeSeconds: Number(summaryRow?.averageTimeSeconds ?? 0),
        focusLostEvents: Number(summaryRow?.focusLostEvents ?? 0),
        tabHiddenSeconds: Number(summaryRow?.tabHiddenSeconds ?? 0),
        pasteEvents: Number(summaryRow?.pasteEvents ?? 0),
      },
      questions,
      students: studentRows.map((row) => ({
        ...row,
        attempts: Number(row.attempts),
        bestScore: toNumber(row.bestScore),
        averageScore: toNumber(row.averageScore),
        lastScore: toNumber(row.lastScore),
        totalTimeSeconds: Number(row.totalTimeSeconds),
        focusLostCount: Number(row.focusLostCount),
        tabHiddenSeconds: Number(row.tabHiddenSeconds),
        pasteCount: Number(row.pasteCount),
      })),
      daily: dailyRows.map((row) => ({
        date: row.date,
        attempts: Number(row.attempts),
        averageScore: Number(row.averageScore),
      })),
    }
  }

  /** Starts a new attempt or resumes the active one. */
  async startAttempt(
    user: PublicUser,
    courseId: string,
    lessonId: string,
  ): Promise<QuizAttemptStateResponse> {
    const context = await this.resolveContext(courseId, lessonId, user)

    if (context.components.size === 0) {
      throw new AppException(
        409,
        ErrorCodes.QuizNotAvailable,
        'This quiz does not have questions yet.',
      )
    }

    const active = await this.finalizeExpired(context, user.id)
    if (active) return this.toState(active)

    const used = await this.attempts.count({
      where: {
        studentId: user.id,
        courseId,
        lessonId,
        status: In([QuizAttemptStatus.Submitted, QuizAttemptStatus.Expired]),
      },
    })

    if (used >= context.settings.maxAttempts) {
      throw new AppException(
        409,
        ErrorCodes.QuizNoAttemptsLeft,
        'You have no attempts left for this quiz.',
      )
    }

    const now = new Date()
    const attempt = this.attempts.create({
      courseId,
      templateId: context.templateId,
      studentId: user.id,
      lessonId,
      quizTitle: context.title,
      status: QuizAttemptStatus.InProgress,
      attemptNumber: used + 1,
      questionCount: context.components.size,
      timeLimitMinutes: context.settings.timeLimitMinutes,
      passScore: context.settings.passScore,
      startedAt: now,
      expiresAt:
        context.settings.timeLimitMinutes > 0
          ? new Date(
              now.getTime() + context.settings.timeLimitMinutes * 60_000,
            )
          : null,
      answers: {},
      results: null,
      score: null,
      correctCount: 0,
      incorrectCount: 0,
      reviewCount: 0,
      passed: null,
      timeSpentSeconds: 0,
      focusLostCount: 0,
      tabHiddenSeconds: 0,
      pasteCount: 0,
    })

    try {
      return this.toState(await this.attempts.save(attempt))
    } catch (error) {
      if (isUniqueViolation(error)) {
        const active = await this.findActive(user.id, courseId, lessonId)
        if (active) return this.toState(active)
      }

      throw error
    }
  }

  /** Returns one attempt (used to resync the timer after a tab sleep). */
  async getAttempt(
    user: PublicUser,
    attemptId: string,
  ): Promise<QuizAttemptStateResponse> {
    const attempt = await this.requireAttempt(user, attemptId)
    const context = await this.resolveContext(
      attempt.courseId,
      attempt.lessonId,
      user,
    )

    const finalized = await this.finalizeIfExpired(attempt, context)
    return this.toState(finalized)
  }

  /**
   * Autosave. It is intentionally idempotent: repeating the same payload is
   * safe, and an expired attempt is graded with the answers already on the
   * server instead of accepting late changes.
   */
  async saveProgress(
    user: PublicUser,
    attemptId: string,
    dto: QuizProgressDto,
  ): Promise<QuizAttemptStateResponse> {
    const attempt = await this.requireAttempt(user, attemptId)
    const context = await this.resolveContext(
      attempt.courseId,
      attempt.lessonId,
      user,
    )

    if (attempt.status !== QuizAttemptStatus.InProgress) {
      return this.toState(attempt)
    }

    const expired = await this.finalizeIfExpired(attempt, context)
    if (expired.status !== QuizAttemptStatus.InProgress) {
      return this.toState(expired)
    }

    attempt.answers = sanitizeAnswers(dto.answers, context.components)
    attempt.focusLostCount = Math.max(
      attempt.focusLostCount,
      dto.focusLostCount ?? 0,
    )
    attempt.tabHiddenSeconds = Math.max(
      attempt.tabHiddenSeconds,
      dto.tabHiddenSeconds ?? 0,
    )
    attempt.pasteCount = Math.max(attempt.pasteCount, dto.pasteCount ?? 0)

    return this.toState(await this.attempts.save(attempt))
  }

  /** Grades on the server and returns the final state. */
  async submitAttempt(
    user: PublicUser,
    attemptId: string,
    dto: QuizProgressDto,
  ): Promise<QuizAttemptStateResponse> {
    const attempt = await this.requireAttempt(user, attemptId)
    const context = await this.resolveContext(
      attempt.courseId,
      attempt.lessonId,
      user,
    )

    if (attempt.status !== QuizAttemptStatus.InProgress) {
      return this.toState(attempt)
    }

    const now = new Date()
    const expired = Boolean(
      attempt.expiresAt && attempt.expiresAt.getTime() <= now.getTime(),
    )

    attempt.focusLostCount = Math.max(
      attempt.focusLostCount,
      dto.focusLostCount ?? 0,
    )
    attempt.tabHiddenSeconds = Math.max(
      attempt.tabHiddenSeconds,
      dto.tabHiddenSeconds ?? 0,
    )
    attempt.pasteCount = Math.max(attempt.pasteCount, dto.pasteCount ?? 0)

    const answers = expired
      ? ((attempt.answers ?? {}) as Record<string, ExerciseAnswer>)
      : sanitizeAnswers(dto.answers, context.components)

    return this.toState(
      await this.gradeAndFinalize(
        attempt,
        context,
        expired ? QuizAttemptStatus.Expired : QuizAttemptStatus.Submitted,
        answers,
        now,
      ),
    )
  }

  private async resolveContext(
    courseId: string,
    lessonId: string,
    user: PublicUser,
  ): Promise<QuizContext> {
    const course = await this.courses.findById(courseId)

    if (
      !course ||
      (course.status !== CourseStatus.Published &&
        course.teacherId !== user.id)
    ) {
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
        'Enroll in the course before taking its quizzes.',
      )
    }

    const content = await this.contents.findByTemplateId(
      course.templateId ?? course.id,
    )
    const lesson = findLesson(content?.modules, lessonId)

    if (!lesson || lesson.type !== 'quiz') {
      throw new AppException(
        404,
        ErrorCodes.QuizNotAvailable,
        'This quiz was not found.',
      )
    }

    const components = collectExerciseComponents(lesson.components)

    return {
      course,
      lessonId,
      content,
      components,
      settings: readQuizSettings(lesson),
      title: asString(lesson.title) || 'Quiz',
      templateId: course.templateId ?? course.id,
    }
  }

  private async requireAttempt(
    user: PublicUser,
    attemptId: string,
  ): Promise<QuizAttempt> {
    const attempt = await this.attempts.findOne({ where: { id: attemptId } })

    if (!attempt || attempt.studentId !== user.id) {
      throw new AppException(
        404,
        ErrorCodes.QuizAttemptNotFound,
        'Quiz attempt not found.',
      )
    }

    return attempt
  }

  private findActive(
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<QuizAttempt | null> {
    return this.attempts.findOne({
      where: {
        studentId,
        courseId,
        lessonId,
        status: QuizAttemptStatus.InProgress,
      },
      order: { attemptNumber: 'DESC' },
    })
  }

  private async finalizeExpired(
    context: QuizContext,
    studentId: string,
  ): Promise<QuizAttempt | null> {
    const active = await this.findActive(
      studentId,
      context.course.id,
      context.lessonId,
    )

    if (!active) return null

    const finalized = await this.finalizeIfExpired(active, context)

    return finalized.status === QuizAttemptStatus.InProgress
      ? finalized
      : null
  }

  private async finalizeIfExpired(
    attempt: QuizAttempt,
    context: QuizContext,
  ): Promise<QuizAttempt> {
    if (
      attempt.status !== QuizAttemptStatus.InProgress ||
      !attempt.expiresAt ||
      attempt.expiresAt.getTime() > Date.now()
    ) {
      return attempt
    }

    return this.gradeAndFinalize(
      attempt,
      context,
      QuizAttemptStatus.Expired,
      (attempt.answers ?? {}) as Record<string, ExerciseAnswer>,
      new Date(),
    )
  }

  private async gradeAndFinalize(
    attempt: QuizAttempt,
    context: QuizContext,
    status: QuizAttemptStatus,
    answers: Record<string, ExerciseAnswer>,
    now: Date,
  ): Promise<QuizAttempt> {
    const version = contentVersion(context.content)
    const results: GradedExerciseResponse[] = []
    let totalScore = 0
    let correct = 0
    let incorrect = 0
    let review = 0

    for (const component of context.components.values()) {
      const answer = sanitizeAnswerForComponent(
        answers[component.id],
        component,
      )
      const result = gradeExercise(
        this.cache.get(component, version),
        toExerciseAnswer({
          optionIds: answer.optionIds,
          text: answer.text,
          blanks: answer.blanks,
          order: answer.order,
          matches: answer.matches,
        }),
      )

      results.push({ componentId: component.id, result })
      totalScore += result.score

      if (result.status === 'correct') correct += 1
      else if (result.status === 'incorrect') incorrect += 1
      else review += 1
    }

    const questionCount = context.components.size
    const score =
      questionCount > 0
        ? Math.round((totalScore / questionCount) * 10000) / 100
        : 0
    const expired = status === QuizAttemptStatus.Expired
    const endTime =
      expired && attempt.expiresAt ? attempt.expiresAt : now

    attempt.status = status
    attempt.submittedAt = now
    attempt.answers = answers as unknown as Record<string, unknown>
    attempt.results = results
    attempt.score = score.toFixed(2)
    attempt.correctCount = correct
    attempt.incorrectCount = incorrect
    attempt.reviewCount = review
    attempt.passed = score >= context.settings.passScore
    attempt.timeSpentSeconds = Math.max(
      0,
      Math.round((endTime.getTime() - attempt.startedAt.getTime()) / 1000),
    )

    return this.attempts.save(attempt)
  }

  private toState(attempt: QuizAttempt): QuizAttemptStateResponse {
    const now = Date.now()
    const remainingSeconds =
      attempt.status === QuizAttemptStatus.InProgress && attempt.expiresAt
        ? Math.max(
            0,
            Math.ceil((attempt.expiresAt.getTime() - now) / 1000),
          )
        : attempt.status === QuizAttemptStatus.InProgress
          ? null
          : 0

    return {
      id: attempt.id,
      courseId: attempt.courseId,
      lessonId: attempt.lessonId,
      quizTitle: attempt.quizTitle,
      status: attempt.status,
      attemptNumber: attempt.attemptNumber,
      questionCount: attempt.questionCount,
      timeLimitMinutes: attempt.timeLimitMinutes,
      passScore: attempt.passScore,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      remainingSeconds,
      answers: (attempt.answers ?? {}) as Record<string, ExerciseAnswer>,
      results: (attempt.results ?? null) as GradedExerciseResponse[] | null,
      score: toNumber(attempt.score),
      correctCount: attempt.correctCount,
      incorrectCount: attempt.incorrectCount,
      reviewCount: attempt.reviewCount,
      passed: attempt.passed,
      timeSpentSeconds: attempt.timeSpentSeconds,
      focusLostCount: attempt.focusLostCount,
      tabHiddenSeconds: attempt.tabHiddenSeconds,
      pasteCount: attempt.pasteCount,
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false

  const driverError = (
    error as QueryFailedError & { driverError?: { code?: string } }
  ).driverError

  return driverError?.code === '23505'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function findLesson(
  modules: unknown,
  lessonId: string,
): Record<string, unknown> | null {
  if (!Array.isArray(modules)) return null

  for (const module of modules) {
    if (!isRecord(module) || !Array.isArray(module.lessons)) continue

    for (const lesson of module.lessons) {
      if (isRecord(lesson) && lesson.id === lessonId) return lesson
    }
  }

  return null
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function readQuizSettings(lesson: Record<string, unknown>): QuizSettings {
  const quiz = isRecord(lesson.quiz) ? lesson.quiz : {}

  return {
    timeLimitMinutes: clampInt(quiz.timeLimitMinutes, 0, 600, 10),
    maxAttempts: clampInt(quiz.maxAttempts, 1, 20, 1),
    passScore: clampInt(quiz.passScore, 0, 100, 60),
  }
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .slice(0, 200)
    .map((item) => item.slice(0, 500))
}

function sanitizeMatches(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}

  const result: Record<string, string> = {}

  for (const [key, item] of Object.entries(value).slice(0, 200)) {
    if (typeof item === 'string') {
      result[key.slice(0, 200)] = item.slice(0, 500)
    }
  }

  return result
}

function sanitizeAnswer(value: unknown): ExerciseAnswer | null {
  if (!isRecord(value)) return null

  return {
    optionIds: asStringArray(value.optionIds),
    text: asString(value.text).slice(0, 20000),
    blanks: asStringArray(value.blanks),
    order: asStringArray(value.order),
    matches: sanitizeMatches(value.matches),
  }
}

function sanitizeAnswerForComponent(
  value: ExerciseAnswer | undefined,
  component: ExerciseComponent,
): ExerciseAnswer {
  if (!value) return EMPTY_ANSWER

  // Keep only ids that belong to this component. A student cannot inject an
  // option from another question to inflate a score.
  const optionIds = new Set((component.options ?? []).map((option) => option.id))
  const pairIds = new Set((component.pairs ?? []).map((pair) => pair.id))

  return {
    optionIds: value.optionIds.filter((id) => optionIds.has(id)),
    text: value.text,
    blanks: value.blanks.slice(0, 100),
    order: value.order.filter((id) => optionIds.has(id)),
    matches: Object.fromEntries(
      Object.entries(value.matches).filter(
        ([key, target]) => pairIds.has(key) && pairIds.has(target),
      ),
    ),
  }
}

function sanitizeAnswers(
  input: Record<string, unknown>,
  components: Map<string, ExerciseComponent>,
): Record<string, ExerciseAnswer> {
  const answers: Record<string, ExerciseAnswer> = {}

  for (const [componentId, value] of Object.entries(input)) {
    const component = components.get(componentId)
    if (!component) continue

    const answer = sanitizeAnswer(value)
    if (answer) answers[componentId] = sanitizeAnswerForComponent(answer, component)
  }

  return answers
}
