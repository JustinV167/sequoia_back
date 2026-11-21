import type { ExerciseResult, PreparedExercise } from './grading.types'
import {
  containsPhrase,
  countWords,
  normalizeAnswerText,
} from './normalize'
import { incorrectResult, reviewResult } from './result'

const REVIEW_COVERAGE_THRESHOLD = 0.7

/**
 * Development answers never get an automatic "correct": the system only
 * enforces a hard gate (minimum length and forbidden concepts) and reports
 * concept coverage so a teacher can review.
 */
export function gradeEssay(
  prepared: PreparedExercise,
  text: string,
): ExerciseResult {
  if (!text.trim()) {
    return incorrectResult('No escribiste una respuesta.', 'length')
  }

  const words = countWords(text)

  if (prepared.minWords > 0 && words < prepared.minWords) {
    return incorrectResult(
      `Escribiste ${words} ${
        words === 1 ? 'palabra' : 'palabras'
      }; el mínimo es ${prepared.minWords}.`,
      'length',
    )
  }

  const normalized = normalizeAnswerText(text)
  const forbidden = prepared.forbiddenConcepts.filter((concept) =>
    containsPhrase(normalized, concept),
  )

  if (forbidden.length > 0) {
    return incorrectResult(
      `Incluye conceptos que no corresponden: ${forbidden.join(', ')}.`,
      'concepts',
    )
  }

  if (prepared.conceptGroups.length === 0) {
    return reviewResult(
      'Cumple con la extensión pedida; queda a revisión.',
      'concepts',
      1,
    )
  }

  const missing = prepared.conceptGroups.filter(
    (group) =>
      !group.synonyms.some((synonym) => containsPhrase(normalized, synonym)),
  )
  const coverage =
    (prepared.conceptGroups.length - missing.length) /
    prepared.conceptGroups.length

  if (missing.length === 0) {
    return reviewResult(
      'Menciona todos los conceptos esperados; queda a revisión.',
      'concepts',
      coverage,
    )
  }

  const coverageNote =
    coverage >= REVIEW_COVERAGE_THRESHOLD
      ? 'Cobertura suficiente; queda a revisión.'
      : 'Cobertura insuficiente; queda a revisión.'

  return reviewResult(
    `Falta mencionar: ${missing
      .map((group) => group.label)
      .join(', ')}. ${coverageNote}`,
    'concepts',
    coverage,
    missing.map((group) => group.label),
  )
}
