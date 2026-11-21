import { boundedEditDistance, maxErrorsFor } from './edit-distance'
import type { ExerciseResult, PreparedExercise } from './grading.types'
import {
  normalizeAnswerText,
  setsEqual,
  tokenSet,
} from './normalize'
import { correctResult, incorrectResult, reviewResult } from './result'

/** Minimum similarity required after a typo-tolerant match. */
const MIN_FUZZY_RATIO = 0.85

/**
 * Short-answer cascade. It stops at the first hit:
 *   1. normalized equality,
 *   2. token set equality (order-free, stop words and simple plurals),
 *   3. bounded Levenshtein with a length-dependent typo budget.
 */
export function gradeShort(
  prepared: PreparedExercise,
  text: string,
): ExerciseResult {
  const alternatives = prepared.shortAlternatives

  if (alternatives.length === 0) {
    return reviewResult(
      'La pregunta todavía no tiene respuesta de referencia.',
      'missing-reference',
    )
  }

  const expected = [alternatives[0].raw]
  const given = normalizeAnswerText(text)

  if (!given) {
    return incorrectResult(
      'No escribiste una respuesta.',
      'length',
      expected,
    )
  }

  // 1. Same normalized text.
  if (alternatives.some((alternative) => alternative.normalized === given)) {
    return correctResult('Coincide con la respuesta esperada.', 'exact')
  }

  // 2. Same meaningful words, in any order.
  const givenTokens = tokenSet(text)
  if (
    givenTokens.size > 0 &&
    alternatives.some((alternative) => setsEqual(alternative.tokens, givenTokens))
  ) {
    return correctResult(
      'Coincide con la respuesta esperada.',
      'tokens',
    )
  }

  // 3. Real typos only: the budget grows with the reference length and a
  // similarity floor prevents accepting a different word.
  let typoChecked = false

  for (const alternative of alternatives) {
    const budget = maxErrorsFor(alternative.normalized.length)
    if (budget === 0) continue

    typoChecked = true
    const distance = boundedEditDistance(given, alternative.normalized, budget)
    if (distance > budget) continue

    const ratio =
      1 - distance / Math.max(given.length, alternative.normalized.length)

    if (ratio >= MIN_FUZZY_RATIO) {
      return correctResult(
        'Coincide con la respuesta esperada (tolera un error de escritura).',
        'fuzzy',
      )
    }
  }

  return incorrectResult(
    'No coincide con la respuesta esperada.',
    typoChecked ? 'fuzzy' : 'tokens',
    expected,
  )
}
