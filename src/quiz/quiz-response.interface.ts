import type { ExerciseAnswer } from '../assessments/grading/grading.types'
import type { GradedExerciseResponse } from '../assessments/types/assessment-response.interface'
import type { QuizAttemptStatus } from './quiz-status.enum'

export interface QuizAttemptStateResponse {
  id: string
  courseId: string
  lessonId: string
  quizTitle: string | null
  status: QuizAttemptStatus
  attemptNumber: number
  questionCount: number
  timeLimitMinutes: number
  passScore: number
  startedAt: Date
  expiresAt: Date | null
  submittedAt: Date | null
  /** Remaining seconds on the server clock (null when there is no limit). */
  remainingSeconds: number | null
  answers: Record<string, ExerciseAnswer>
  results: GradedExerciseResponse[] | null
  score: number | null
  correctCount: number
  incorrectCount: number
  reviewCount: number
  passed: boolean | null
  timeSpentSeconds: number
  focusLostCount: number
  tabHiddenSeconds: number
  pasteCount: number
}

export interface QuizInfoResponse {
  courseId: string
  lessonId: string
  title: string
  questionCount: number
  timeLimitMinutes: number
  maxAttempts: number
  passScore: number
  attemptsUsed: number
  attemptsRemaining: number
  bestScore: number | null
  lastScore: number | null
  passed: boolean
  activeAttempt: QuizAttemptStateResponse | null
  history: QuizAttemptStateResponse[]
}

export interface QuizStatsQuestionResponse {
  componentId: string
  question: string
  type: string
  answers: number
  correct: number
  incorrect: number
  review: number
  accuracy: number
  averageScore: number
}

export interface QuizStatsStudentResponse {
  studentId: string
  fullName: string
  email: string
  attempts: number
  bestScore: number | null
  averageScore: number | null
  lastScore: number | null
  passed: boolean
  lastAttemptAt: Date | null
  totalTimeSeconds: number
  focusLostCount: number
  tabHiddenSeconds: number
  pasteCount: number
}

export interface QuizStatsDayResponse {
  date: string
  attempts: number
  averageScore: number
}

export interface QuizStatsResponse {
  quiz: {
    courseId: string
    lessonId: string
    title: string
    questionCount: number
    timeLimitMinutes: number
    maxAttempts: number
    passScore: number
  }
  summary: {
    students: number
    attempts: number
    passedAttempts: number
    averageScore: number
    bestScore: number | null
    worstScore: number | null
    averageTimeSeconds: number
    focusLostEvents: number
    tabHiddenSeconds: number
    pasteEvents: number
  }
  questions: QuizStatsQuestionResponse[]
  students: QuizStatsStudentResponse[]
  daily: QuizStatsDayResponse[]
}
