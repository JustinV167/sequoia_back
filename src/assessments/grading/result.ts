import type {
  ExerciseResult,
  ExerciseResultStatus,
  GradingStep,
} from './grading.types'

export function buildResult(
  status: ExerciseResultStatus,
  score: number,
  message: string,
  step: GradingStep,
  expected: string[] = [],
): ExerciseResult {
  return { status, score, message, expected, step }
}

export function correctResult(
  message: string,
  step: GradingStep,
  expected: string[] = [],
): ExerciseResult {
  return buildResult('correct', 1, message, step, expected)
}

export function incorrectResult(
  message: string,
  step: GradingStep,
  expected: string[] = [],
): ExerciseResult {
  return buildResult('incorrect', 0, message, step, expected)
}

export function reviewResult(
  message: string,
  step: GradingStep,
  score = 0,
  expected: string[] = [],
): ExerciseResult {
  return buildResult('review', score, message, step, expected)
}
