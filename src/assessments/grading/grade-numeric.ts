import type { ExerciseResult, PreparedExercise } from './grading.types'
import { parseAnswerNumber } from './normalize'
import { correctResult, incorrectResult, reviewResult } from './result'

/** Relative margin: 1% of the expected value covers rounding differences. */
const RELATIVE_TOLERANCE = 0.01
const NUMERIC_EPSILON = 1e-9

function formatTolerance(value: number): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 6 })
}

/**
 * Numeric answer: parses comma/dot decimals, thousands separators and simple
 * fractions, then accepts within `max(absolute, 1% of expected)`.
 */
export function gradeNumeric(
  prepared: PreparedExercise,
  text: string,
): ExerciseResult {
  const expected = prepared.numericExpected

  if (expected == null) {
    return reviewResult(
      'La pregunta todavía no tiene resultado esperado.',
      'missing-reference',
    )
  }

  const given = parseAnswerNumber(text)

  if (given == null) {
    return incorrectResult(
      'Lo que escribiste no es un número.',
      'numeric',
      [prepared.numericAnswerText],
    )
  }

  const tolerance = Math.max(
    prepared.numericTolerance,
    Math.abs(expected) * RELATIVE_TOLERANCE,
  )
  const difference = Math.abs(given - expected)
  const toleranceText = formatTolerance(tolerance)

  if (difference <= tolerance + NUMERIC_EPSILON) {
    return correctResult(
      tolerance > 0
        ? `Está dentro del margen de ± ${toleranceText}.`
        : 'Es el resultado exacto.',
      'numeric',
    )
  }

  return incorrectResult(
    tolerance > 0
      ? `Queda fuera del margen de ± ${toleranceText}.`
      : 'No es el resultado esperado.',
    'numeric',
    [prepared.numericAnswerText],
  )
}
