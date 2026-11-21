import type { ActivityEventType } from '../enums/activity-event-type.enum'

export interface TrackEventsResponse {
  /** Events stored for the first time (replayed events are ignored). */
  accepted: number
  /** Events skipped because their `eventId` was already stored. */
  duplicates: number
}

export interface ActivityEventResponse {
  id: string
  eventId: string
  type: ActivityEventType
  userId: string
  courseId: string | null
  moduleId: string | null
  lessonId: string | null
  exerciseId: string | null
  occurredAt: Date
  receivedAt: Date
  durationMs: number | null
  positionSeconds: number | null
  durationSeconds: number | null
  progressPercent: number | null
  score: number | null
  attemptNumber: number | null
  metadata: Record<string, unknown>
}

export interface CourseActivityResponse {
  courseId: string
  firstOpenedAt: Date | null
  lastOpenedAt: Date | null
  visits: number
  totalTimeSeconds: number
  lessonsTotal: number
  lessonsCompleted: number
  exercisesAttempted: number
  exercisesCorrect: number
  progressPercent: number
  lastModuleId: string | null
  lastLessonId: string | null
  completedAt: Date | null
}

export interface ModuleActivityResponse {
  moduleId: string
  moduleTitle: string | null
  firstViewedAt: Date | null
  lastViewedAt: Date | null
  visits: number
  totalTimeSeconds: number
  lessonsTotal: number
  lessonsCompleted: number
  progressPercent: number
}

export interface LessonActivityResponse {
  moduleId: string | null
  lessonId: string
  lessonTitle: string | null
  lessonType: string | null
  firstViewedAt: Date | null
  lastViewedAt: Date | null
  completedAt: Date | null
  totalTimeSeconds: number
  visits: number
  lastPositionSeconds: number | null
  videoDurationSeconds: number | null
  progressPercent: number
}

export interface ExerciseActivityResponse {
  moduleId: string | null
  lessonId: string | null
  exerciseId: string
  exerciseType: string | null
  prompt: string | null
  firstStartedAt: Date | null
  lastStartedAt: Date | null
  firstAttemptedAt: Date | null
  lastAttemptedAt: Date | null
  solvedAt: Date | null
  starts: number
  retries: number
  attempts: number
  correctAttempts: number
  incorrectAttempts: number
  reviewAttempts: number
  bestScore: number | null
  lastScore: number | null
  totalTimeSeconds: number
  lastAnswer: Record<string, unknown> | null
}

export interface ActivityDayResponse {
  date: string
  events: number
  timeSeconds: number
  lessonsCompleted: number
  exercisesAnswered: number
}

export interface MyCourseActivityResponse {
  courseId: string
  course: CourseActivityResponse | null
  modules: ModuleActivityResponse[]
  lessons: LessonActivityResponse[]
  exercises: ExerciseActivityResponse[]
  recentEvents: ActivityEventResponse[]
  timeline: ActivityDayResponse[]
}

export interface StudentActivityDetailResponse
  extends MyCourseActivityResponse {
  student: {
    id: string
    fullName: string
    email: string
  }
}

export interface CourseStudentActivityResponse {
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
}

export interface CourseActivitySummaryResponse {
  courseId: string
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
}

export interface ModuleBreakdownItem {
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
}

export interface LessonBreakdownItem {
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
}

export interface ExerciseBreakdownItem {
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
}

export interface CourseActivityBreakdownResponse {
  courseId: string
  modules: ModuleBreakdownItem[]
  lessons: LessonBreakdownItem[]
  exercises: ExerciseBreakdownItem[]
}
