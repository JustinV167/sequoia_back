import { gradeEssay } from './grade-essay'
import { gradeNumeric } from './grade-numeric'
import { gradeShort } from './grade-short'
import type {
  ExerciseAnswer,
  ExerciseResult,
  PreparedExercise,
} from './grading.types'
import { normalizeAnswerText } from './normalize'
import {
  buildResult,
  correctResult,
  incorrectResult,
  reviewResult,
} from './result'

/**
 * Deterministic correction dispatcher. Every rule is a pure comparison: the
 * teacher writes the expected answer once and the system evaluates what the
 * student sent.
 */
export function gradeExercise(
  prepared: PreparedExercise,
  answer: ExerciseAnswer,
): ExerciseResult {
  switch (prepared.type) {
    case 'multiple':
    case 'truefalse':
      return gradeChoice(prepared, answer)
    case 'multiselect':
      return gradeMultiSelect(prepared, answer)
    case 'short':
      return gradeShort(prepared, answer.text)
    case 'numeric':
      return gradeNumeric(prepared, answer.text)
    case 'fillblank':
      return gradeFillBlank(prepared, answer)
    case 'ordering':
      return gradeOrdering(prepared, answer)
    case 'matching':
      return gradeMatching(prepared, answer)
    case 'essay':
      return gradeEssay(prepared, answer.text)
  }
}

function gradeChoice(
  prepared: PreparedExercise,
  answer: ExerciseAnswer,
): ExerciseResult {
  const expectedId = prepared.correctOptionId

  if (!expectedId) {
    return reviewResult(
      'La pregunta todavía no tiene respuesta.',
      'missing-reference',
    )
  }

  const expectedText = prepared.optionTextById.get(expectedId)
  const correct = answer.optionIds[0] === expectedId

  return correct
    ? correctResult('Respuesta correcta.', 'selection')
    : incorrectResult(
        'La opción elegida no es la correcta.',
        'selection',
        expectedText ? [expectedText] : [],
      )
}

function gradeMultiSelect(
  prepared: PreparedExercise,
  answer: ExerciseAnswer,
): ExerciseResult {
  const expectedIds = prepared.correctOptionIds

  if (expectedIds.length === 0) {
    return reviewResult(
      'La pregunta todavía no tiene respuesta.',
      'missing-reference',
    )
  }

  const expectedTexts = prepared.optionIds
    .filter((id) => expectedIds.includes(id))
    .map((id) => prepared.optionTextById.get(id) ?? '')

  const hits = expectedIds.filter((id) =>
    answer.optionIds.includes(id),
  ).length
  const wrong = answer.optionIds.filter(
    (id) => !expectedIds.includes(id),
  ).length
  const score = Math.max(0, hits - wrong) / expectedIds.length

  if (hits === expectedIds.length && wrong === 0) {
    return correctResult('Elegiste todas las correctas.', 'selection')
  }

  const missing = expectedIds.length - hits

  return buildResult(
    'incorrect',
    score,
    wrong > 0
      ? `Hay ${wrong} ${
          wrong === 1
            ? 'opción que no corresponde'
            : 'opciones que no corresponden'
        }.`
      : `Faltó marcar ${missing} ${
          missing === 1 ? 'opción' : 'opciones'
        }.`,
    'selection',
    expectedTexts,
  )
}

function gradeFillBlank(
  prepared: PreparedExercise,
  answer: ExerciseAnswer,
): ExerciseResult {
  if (prepared.blankCount === 0) {
    return reviewResult(
      'La consigna todavía no tiene espacios.',
      'missing-reference',
    )
  }

  const expectedTexts = prepared.optionIds
    .slice(0, prepared.blankCount)
    .map((id) => prepared.optionTextById.get(id) ?? '')

  const hits = prepared.blankAnswers.filter(
    (expected, index) =>
      expected === normalizeAnswerText(answer.blanks[index] ?? ''),
  ).length

  if (hits === prepared.blankAnswers.length) {
    return correctResult('Completaste todos los espacios.', 'blank')
  }

  return buildResult(
    'incorrect',
    hits / prepared.blankAnswers.length,
    `${hits} de ${prepared.blankAnswers.length} espacios correctos.`,
    'blank',
    expectedTexts,
  )
}

function gradeOrdering(
  prepared: PreparedExercise,
  answer: ExerciseAnswer,
): ExerciseResult {
  if (prepared.optionIds.length === 0) {
    return reviewResult(
      'La consigna todavía no tiene elementos.',
      'missing-reference',
    )
  }

  const expectedTexts = prepared.optionIds.map(
    (id) => prepared.optionTextById.get(id) ?? '',
  )
  const hits = prepared.optionIds.filter(
    (id, index) => answer.order[index] === id,
  ).length

  if (hits === prepared.optionIds.length) {
    return correctResult('El orden es el correcto.', 'order')
  }

  return buildResult(
    'incorrect',
    hits / prepared.optionIds.length,
    `${hits} de ${prepared.optionIds.length} elementos en su lugar.`,
    'order',
    expectedTexts,
  )
}

function gradeMatching(
  prepared: PreparedExercise,
  answer: ExerciseAnswer,
): ExerciseResult {
  if (prepared.pairIds.length === 0) {
    return reviewResult(
      'La consigna todavía no tiene pares.',
      'missing-reference',
    )
  }

  const hits = prepared.pairIds.filter(
    (pairId) => answer.matches[pairId] === pairId,
  ).length

  if (hits === prepared.pairIds.length) {
    return correctResult('Emparejaste todo bien.', 'match')
  }

  return buildResult(
    'incorrect',
    hits / prepared.pairIds.length,
    `${hits} de ${prepared.pairIds.length} pares correctos.`,
    'match',
    prepared.pairLabels,
  )
}
