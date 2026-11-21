import type {
  ExerciseComponent,
  ExerciseType,
  PreparedExercise,
} from './grading.types'
import {
  normalizeAnswerText,
  parseAnswerNumber,
  splitAlternatives,
  splitConceptGroups,
  tokenSet,
} from './normalize'

const EXERCISE_TYPES: readonly ExerciseType[] = [
  'multiple',
  'truefalse',
  'short',
  'fillblank',
  'ordering',
  'matching',
  'multiselect',
  'numeric',
  'essay',
]

export function isExerciseType(value: unknown): value is ExerciseType {
  return (
    typeof value === 'string' &&
    (EXERCISE_TYPES as readonly string[]).includes(value)
  )
}

/** Runs of three or more underscores mark a blank in a fill-in exercise. */
const EXERCISE_BLANK = /_{3,}/g

export function countExerciseBlanks(text: string): number {
  return (text.match(EXERCISE_BLANK) ?? []).length
}

/**
 * Precomputes everything the grading cascade needs. It is cheap (microseconds)
 * and runs once per component + template version thanks to the cache.
 */
export function prepareExercise(
  component: ExerciseComponent,
): PreparedExercise {
  const type = component.exerciseType ?? 'multiple'
  const options = component.options ?? []
  const pairs = component.pairs ?? []
  const text = component.text ?? ''
  const answer = component.answer ?? ''

  const optionTextById = new Map<string, string>(
    options.map((option) => [option.id, option.text]),
  )
  const blankCount = countExerciseBlanks(text)

  return {
    componentId: component.id,
    type,
    correctOptionId: component.correctOptionId ?? null,
    correctOptionIds: component.correctOptionIds ?? [],
    optionIds: options.map((option) => option.id),
    optionTextById,
    pairIds: pairs.map((pair) => pair.id),
    pairLabels: pairs.map((pair) => `${pair.left} ↔ ${pair.right}`),
    blankCount,
    blankAnswers: options
      .slice(0, blankCount)
      .map((option) => normalizeAnswerText(option.text)),
    shortAlternatives: splitAlternatives(answer).map((raw) => ({
      raw,
      normalized: normalizeAnswerText(raw),
      tokens: tokenSet(raw),
    })),
    numericExpected: parseAnswerNumber(answer),
    numericAnswerText: answer,
    numericTolerance: Math.max(0, Math.abs(component.tolerance ?? 0)),
    minWords: Math.max(0, Math.floor(component.minWords ?? 0)),
    conceptGroups: splitConceptGroups(answer),
    forbiddenConcepts: splitAlternatives(component.forbiddenConcepts).map(
      (concept) => normalizeAnswerText(concept),
    ),
  }
}
