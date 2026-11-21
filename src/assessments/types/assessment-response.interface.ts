import type { ExerciseResult } from '../grading/grading.types'

export interface GradedExerciseResponse {
  componentId: string
  result: ExerciseResult
}

export interface AttemptGradeResponse {
  templateId: string
  /** Content version used to prepare the exercises. */
  version: string
  total: number
  correct: number
  incorrect: number
  review: number
  /** Average score of the attempt, 0..1. */
  score: number
  /** CPU time spent grading, in milliseconds. */
  elapsedMs: number
  results: GradedExerciseResponse[]
}

export interface PreviewGradeResponse {
  componentId: string
  version: string
  elapsedMs: number
  result: ExerciseResult
}

export interface PrepareTemplateResponse {
  templateId: string
  version: string
  exercises: number
  elapsedMs: number
}
