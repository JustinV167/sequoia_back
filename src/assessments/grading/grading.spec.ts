import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { boundedEditDistance, maxErrorsFor } from './edit-distance'
import { gradeEssay } from './grade-essay'
import { gradeExercise } from './grade-exercise'
import { gradeNumeric } from './grade-numeric'
import { gradeShort } from './grade-short'
import type {
  ExerciseAnswer,
  ExerciseComponent,
} from './grading.types'
import { normalizeAnswerText } from './normalize'
import { prepareExercise } from './prepare-exercise'

function answer(partial: Partial<ExerciseAnswer> = {}): ExerciseAnswer {
  return {
    optionIds: [],
    text: '',
    blanks: [],
    order: [],
    matches: {},
    ...partial,
  }
}

function short(answerText: string, id = 'q1'): ExerciseComponent {
  return { id, exerciseType: 'short', answer: answerText }
}

describe('normalization', () => {
  it('removes accents, punctuation and extra spaces', () => {
    assert.equal(normalizeAnswerText('  ¿Mercurio?  '), 'mercurio')
    assert.equal(normalizeAnswerText('Fotosíntesis'), 'fotosintesis')
    assert.equal(normalizeAnswerText('Juan   Pérez.'), 'juan perez')
  })
})

describe('bounded edit distance', () => {
  it('counts one substitution', () => {
    assert.equal(boundedEditDistance('mercurio', 'mercuryo', 1), 1)
  })

  it('returns max + 1 when the bound is exceeded', () => {
    assert.equal(boundedEditDistance('gato', 'pato', 0), 1)
    assert.equal(boundedEditDistance('abc', 'abcdef', 2), 3)
  })

  it('gives no typo budget to short words', () => {
    assert.equal(maxErrorsFor(4), 0)
    assert.equal(maxErrorsFor(6), 1)
    assert.equal(maxErrorsFor(10), 2)
  })
})

describe('short answers', () => {
  const alternatives =
    'Mercurio; Mercurio (planeta); el planeta más cercano al Sol'

  it('matches an exact answer after normalizing', () => {
    const result = gradeShort(
      prepareExercise(short(alternatives)),
      '  ¿Mercurio? ',
    )

    assert.equal(result.status, 'correct')
    assert.equal(result.step, 'exact')
  })

  it('matches the same meaningful words in any order', () => {
    const result = gradeShort(
      prepareExercise(short('el planeta mercurio')),
      'Mercurio, el planeta',
    )

    assert.equal(result.status, 'correct')
    assert.equal(result.step, 'tokens')
  })

  it('applies the light singular form', () => {
    const result = gradeShort(
      prepareExercise(short('planeta mercurio')),
      'planetas mercurio',
    )

    assert.equal(result.status, 'correct')
    assert.equal(result.step, 'tokens')
  })

  it('accepts a real typo in a long word', () => {
    const result = gradeShort(
      prepareExercise(short('mercurio')),
      'mercuryo',
    )

    assert.equal(result.status, 'correct')
    assert.equal(result.step, 'fuzzy')
  })

  it('never accepts a different short word', () => {
    const result = gradeShort(prepareExercise(short('gato')), 'pato')

    assert.equal(result.status, 'incorrect')
  })

  it('rejects a two-edit answer when similarity is below 0.85', () => {
    const result = gradeShort(
      prepareExercise(short('abcdefghij')),
      'abcdefghXY',
    )

    assert.equal(result.status, 'incorrect')
  })

  it('asks for review when the teacher did not load alternatives', () => {
    const result = gradeShort(prepareExercise(short('')), 'mercurio')

    assert.equal(result.status, 'review')
    assert.equal(result.step, 'missing-reference')
  })
})

describe('numeric answers', () => {
  it('parses comma decimals, dot thousands and fractions', () => {
    const plain = gradeNumeric(
      prepareExercise({ id: 'n1', exerciseType: 'numeric', answer: '1.234,5' }),
      '1234.5',
    )
    const fraction = gradeNumeric(
      prepareExercise({ id: 'n2', exerciseType: 'numeric', answer: '3/4' }),
      '0,75',
    )

    assert.equal(plain.status, 'correct')
    assert.equal(fraction.status, 'correct')
  })

  it('uses a 1% relative tolerance to absorb rounding', () => {
    const inside = gradeNumeric(
      prepareExercise({ id: 'n1', exerciseType: 'numeric', answer: '1000' }),
      '1005',
    )
    const outside = gradeNumeric(
      prepareExercise({ id: 'n2', exerciseType: 'numeric', answer: '1000' }),
      '1020',
    )

    assert.equal(inside.status, 'correct')
    assert.equal(outside.status, 'incorrect')
  })

  it('respects the absolute tolerance as well', () => {
    const result = gradeNumeric(
      prepareExercise({
        id: 'n1',
        exerciseType: 'numeric',
        answer: '10',
        tolerance: 0.5,
      }),
      '10,4',
    )

    assert.equal(result.status, 'correct')
  })

  it('rejects text that is not a number', () => {
    const result = gradeNumeric(
      prepareExercise({ id: 'n1', exerciseType: 'numeric', answer: '10' }),
      'diez',
    )

    assert.equal(result.status, 'incorrect')
    assert.equal(result.step, 'numeric')
  })
})

describe('development answers', () => {
  const essay = (overrides: Partial<ExerciseComponent> = {}) => ({
    id: 'e1',
    exerciseType: 'essay' as const,
    answer: 'fotosíntesis|síntesis clorofílica; clorofila',
    minWords: 3,
    ...overrides,
  })

  it('never returns correct automatically', () => {
    const result = gradeEssay(
      prepareExercise(essay()),
      'La fotosíntesis usa clorofila',
    )

    assert.equal(result.status, 'review')
    assert.equal(result.step, 'concepts')
    assert.equal(result.score, 1)
  })

  it('reports the missing concepts and the coverage', () => {
    const result = gradeEssay(
      prepareExercise(essay()),
      'La fotosíntesis ocurre en las plantas verdes',
    )

    assert.equal(result.status, 'review')
    assert.ok(result.score < 1)
    assert.match(result.message, /clorofila/)
  })

  it('enforces the minimum length before concepts', () => {
    const result = gradeEssay(
      prepareExercise(essay({ minWords: 10 })),
      'Usa clorofila',
    )

    assert.equal(result.status, 'incorrect')
    assert.equal(result.step, 'length')
  })

  it('rejects an empty development answer', () => {
    const result = gradeEssay(
      prepareExercise(essay({ minWords: 0 })),
      '   ',
    )

    assert.equal(result.status, 'incorrect')
    assert.equal(result.step, 'length')
  })

  it('rejects forbidden concepts', () => {
    const result = gradeEssay(
      prepareExercise(essay({ forbiddenConcepts: 'osmosis' })),
      'La fotosíntesis y la clorofila aparecen por osmosis',
    )

    assert.equal(result.status, 'incorrect')
    assert.equal(result.step, 'concepts')
  })
})

describe('closed exercise types', () => {
  const options = [
    { id: 'a', text: 'Mercurio' },
    { id: 'b', text: 'Venus' },
  ]

  it('grades multiple choice', () => {
    const prepared = prepareExercise({
      id: 'm1',
      exerciseType: 'multiple',
      options,
      correctOptionId: 'a',
    })

    assert.equal(
      gradeExercise(prepared, answer({ optionIds: ['a'] })).status,
      'correct',
    )
    assert.equal(
      gradeExercise(prepared, answer({ optionIds: ['b'] })).status,
      'incorrect',
    )
  })

  it('penalizes wrong options in a multi-select', () => {
    const prepared = prepareExercise({
      id: 'm2',
      exerciseType: 'multiselect',
      options,
      correctOptionIds: ['a', 'b'],
    })

    const partial = gradeExercise(prepared, answer({ optionIds: ['a'] }))
    const withWrong = gradeExercise(
      prepared,
      answer({ optionIds: ['a', 'b', 'c'] }),
    )

    assert.equal(partial.status, 'incorrect')
    assert.equal(partial.score, 0.5)
    assert.equal(withWrong.status, 'incorrect')
  })

  it('grades fill-in-the-blank exercises', () => {
    const prepared = prepareExercise({
      id: 'f1',
      exerciseType: 'fillblank',
      text: 'La capital es ___ y el río ___',
      options: [
        { id: 'b1', text: 'Buenos Aires' },
        { id: 'b2', text: 'Paraná' },
      ],
    })

    assert.equal(
      gradeExercise(
        prepared,
        answer({ blanks: ['Buenos Aires', 'Paraná'] }),
      ).status,
      'correct',
    )
  })

  it('grades ordering exercises', () => {
    const prepared = prepareExercise({
      id: 'o1',
      exerciseType: 'ordering',
      options,
    })

    assert.equal(
      gradeExercise(prepared, answer({ order: ['a', 'b'] })).status,
      'correct',
    )
    assert.equal(
      gradeExercise(prepared, answer({ order: ['b', 'a'] })).status,
      'incorrect',
    )
  })

  it('grades matching exercises', () => {
    const prepared = prepareExercise({
      id: 'p1',
      exerciseType: 'matching',
      pairs: [{ id: 'pair-1', left: 'Mercurio', right: 'Planeta' }],
    })

    assert.equal(
      gradeExercise(prepared, answer({ matches: { 'pair-1': 'pair-1' } }))
        .status,
      'correct',
    )
  })
})
