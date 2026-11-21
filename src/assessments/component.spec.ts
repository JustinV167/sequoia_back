import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  collectExerciseComponents,
  contentVersion,
  hashComponent,
  toExerciseComponent,
} from './component'

describe('exercise component extraction', () => {
  const modules = [
    {
      id: 'module-1',
      lessons: [
        {
          id: 'lesson-1',
          components: [
            { id: 'heading-1', type: 'heading', text: 'Hola' },
            {
              id: 'exercise-1',
              type: 'exercise',
              exerciseType: 'short',
              answer: 'Mercurio',
              options: [{ id: 'option-1', text: 'Mercurio' }],
            },
            {
              id: 'exercise-2',
              type: 'exercise',
              exerciseType: 'matching',
              pairs: [{ id: 'pair-1', left: 'a', right: 'b' }],
            },
          ],
        },
      ],
    },
  ]

  it('collects exercise blocks and ignores options and pairs', () => {
    const components = collectExerciseComponents(modules)

    assert.deepEqual([...components.keys()].sort(), [
      'exercise-1',
      'exercise-2',
    ])
  })

  it('rejects objects that are not exercise blocks', () => {
    assert.equal(
      toExerciseComponent({ id: 'option-1', text: 'Mercurio' }),
      null,
    )
    assert.equal(
      toExerciseComponent({ id: 'heading-1', type: 'heading' }),
      null,
    )
  })

  it('sanitizes arrays and fills safe defaults', () => {
    const component = toExerciseComponent({
      id: 'exercise-1',
      type: 'exercise',
      exerciseType: 'multiple',
      options: [
        { id: 'option-1', text: 'Mercurio' },
        { invalid: true },
      ],
      correctOptionIds: ['option-1', 3],
    })

    assert.ok(component)
    assert.deepEqual(component.options, [
      { id: 'option-1', text: 'Mercurio' },
    ])
    assert.deepEqual(component.correctOptionIds, ['option-1'])
    assert.deepEqual(component.pairs, [])
  })
})

describe('prepared cache helpers', () => {
  it('uses the content updatedAt as the version', () => {
    const updatedAt = new Date('2026-11-20T12:00:00.000Z')

    assert.equal(
      contentVersion({ updatedAt }),
      '2026-11-20T12:00:00.000Z',
    )
  })

  it('falls back to v1 when the content has no timestamp', () => {
    assert.equal(contentVersion({}), 'v1')
  })

  it('hashes a component deterministically', () => {
    const component = {
      id: 'exercise-1',
      exerciseType: 'short' as const,
      answer: 'Mercurio',
    }

    assert.equal(hashComponent(component), hashComponent(component))
    assert.notEqual(
      hashComponent(component),
      hashComponent({ ...component, answer: 'Venus' }),
    )
  })
})
