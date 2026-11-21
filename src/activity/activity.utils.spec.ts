import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  countLessons,
  firstReturnedRow,
  lessonsPerModule,
  resolveOccurredAt,
  returnedRows,
  sanitizeMetadata,
} from './activity.utils'

describe('TypeORM RETURNING normalisation', () => {
  it('unwraps [rows, rowCount] from UPDATE ... RETURNING', () => {
    const result = [[{ progress_percent: 100 }], 1]

    assert.deepEqual(returnedRows(result), [{ progress_percent: 100 }])
    assert.deepEqual(firstReturnedRow(result), { progress_percent: 100 })
  })

  it('reads plain rows from SELECT / INSERT ... RETURNING', () => {
    const result = [{ event_id: 'event-1' }]

    assert.deepEqual(returnedRows(result), [{ event_id: 'event-1' }])
    assert.deepEqual(firstReturnedRow(result), { event_id: 'event-1' })
  })

  it('returns null when the statement affected no rows', () => {
    assert.deepEqual(returnedRows([[], 0]), [])
    assert.equal(firstReturnedRow([[], 0]), null)
  })
})

describe('course content counting', () => {
  it('counts lessons per course and per module', () => {
    const modules = [
      { id: 'module-1', lessons: [{}, {}] },
      { id: 'module-2', lessons: [{}] },
    ]

    assert.equal(countLessons(modules), 3)
    assert.deepEqual([...lessonsPerModule(modules)], [
      ['module-1', 2],
      ['module-2', 1],
    ])
  })

  it('ignores malformed content', () => {
    assert.equal(countLessons(null), 0)
    assert.equal(countLessons([{ lessons: 'nope' }]), 0)
  })
})

describe('client metadata sanitisation', () => {
  it('trims long strings and keeps bounded structures', () => {
    const metadata = sanitizeMetadata({
      answer: 'a'.repeat(5000),
      attempts: 3,
      nested: { ok: true },
    })

    assert.equal((metadata.answer as string).length, 2000)
    assert.equal(metadata.attempts, 3)
    assert.deepEqual(metadata.nested, { ok: true })
  })

  it('rejects timestamps too far in the future or past', () => {
    const now = new Date('2026-01-15T12:00:00.000Z')

    assert.equal(
      resolveOccurredAt('2026-01-15T12:00:30.000Z', now).toISOString(),
      '2026-01-15T12:00:30.000Z',
    )
    assert.equal(
      resolveOccurredAt('2027-01-15T12:00:00.000Z', now).toISOString(),
      '2026-01-15T12:00:00.000Z',
    )
    assert.equal(
      resolveOccurredAt('2020-01-15T12:00:00.000Z', now).toISOString(),
      '2026-01-15T12:00:00.000Z',
    )
  })
})
