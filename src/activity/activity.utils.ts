/** Max accepted age of a client timestamp (30 days) and clock skew (60 s). */
const MAX_EVENT_AGE_MS = 30 * 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 60 * 1000
const MAX_METADATA_STRING = 2000
const MAX_METADATA_DEPTH = 4

export function groupBy<T>(
  items: T[],
  keyOf: (item: T) => string | null | undefined,
): Map<string, T[]> {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const key = keyOf(item)
    if (!key) continue

    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  return groups
}

/**
 * Client clocks are not trusted blindly: a timestamp in the future or too old
 * would distort time-on-task, so it is replaced by the moment of reception.
 */
export function resolveOccurredAt(value: string | undefined, now: Date): Date {
  if (!value) return now

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return now

  const delta = parsed.getTime() - now.getTime()
  if (delta > MAX_CLOCK_SKEW_MS || delta < -MAX_EVENT_AGE_MS) return now

  return parsed
}

export function truncate(
  value: string | null | undefined,
  length: number,
): string | null {
  if (!value) return null
  return value.replace(/\u0000/g, '').slice(0, length)
}

export function metaString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key]
  return typeof value === 'string' ? value : null
}

export function metaNumber(
  metadata: Record<string, unknown>,
  key: string,
): number | null {
  const value = metadata[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * TypeORM returns `[rows, rowCount]` for `UPDATE ... RETURNING`, but a plain
 * row array for `SELECT`/`INSERT ... RETURNING`. This normalises both shapes.
 */
export function returnedRows<T>(result: unknown): T[] {
  if (!Array.isArray(result)) return []

  return (Array.isArray(result[0]) ? result[0] : result) as T[]
}

export function firstReturnedRow<T>(result: unknown): T | null {
  return returnedRows<T>(result)[0] ?? null
}

/**
 * Metadata is free-form on purpose, but it is stored in a JSONB column shared
 * by every event. Long strings and deep objects are trimmed so one client
 * cannot bloat the table or break `JSON.stringify`.
 */
export function sanitizeMetadata(value: unknown): Record<string, unknown> {
  const cleaned = sanitizeJson(value, 0)

  return cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)
    ? (cleaned as Record<string, unknown>)
    : {}
}

function sanitizeJson(value: unknown, depth: number): unknown {
  if (depth > MAX_METADATA_DEPTH) return null

  if (value == null) return null
  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '').slice(0, MAX_METADATA_STRING)
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeJson(item, depth + 1))
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    ).slice(0, 50)) {
      result[key.slice(0, 100)] = sanitizeJson(item, depth + 1)
    }

    return result
  }

  return null
}

/** Total lessons of a template document (`modules[].lessons[]`). */
export function countLessons(modules: unknown): number {
  const list = asModuleList(modules)
  return list.reduce((total, module) => total + module.lessons.length, 0)
}

/** Lesson count per module id, used to compute module progress. */
export function lessonsPerModule(modules: unknown): Map<string, number> {
  const totals = new Map<string, number>()

  for (const module of asModuleList(modules)) {
    if (module.id) totals.set(module.id, module.lessons.length)
  }

  return totals
}

function asModuleList(
  modules: unknown,
): { id: string | null; lessons: unknown[] }[] {
  if (!Array.isArray(modules)) return []

  return modules.flatMap((module) => {
    if (!module || typeof module !== 'object') return []

    const record = module as Record<string, unknown>
    const lessons = Array.isArray(record.lessons) ? record.lessons : []

    return [
      {
        id: typeof record.id === 'string' ? record.id : null,
        lessons,
      },
    ]
  })
}
