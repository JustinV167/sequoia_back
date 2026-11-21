import type {
  ExerciseComponent,
  ExerciseOption,
  ExercisePair,
} from './grading/grading.types'
import { isExerciseType } from './grading/prepare-exercise'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function asOptions(value: unknown): ExerciseOption[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const id = asString(item.id)
    if (!id) return []
    return [{ id, text: asString(item.text) }]
  })
}

function asPairs(value: unknown): ExercisePair[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const id = asString(item.id)
    if (!id) return []
    return [
      {
        id,
        left: asString(item.left),
        right: asString(item.right),
      },
    ]
  })
}

function asForbiddenConcepts(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined
  if (!Array.isArray(value)) return undefined

  const concepts = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)

  return concepts.length > 0 ? concepts.join(';') : undefined
}

/**
 * Reads a fresh copy of the grading fields of a component. The content in
 * MongoDB is an opaque document, so this is the only place that trusts its
 * shape; everything downstream works with typed, sanitized values.
 */
export function toExerciseComponent(value: unknown): ExerciseComponent | null {
  if (!isRecord(value)) return null

  const id = asString(value.id)
  if (!id) return null

  const type = asString(value.type)
  const exerciseType = isExerciseType(value.exerciseType)
    ? value.exerciseType
    : undefined

  // Only real exercise blocks are graded. Without this check any object with
  // an `id` (an option, a pair, a section) would look like a component.
  if (type !== 'exercise' && !exerciseType) return null

  return {
    id,
    type: type || 'exercise',
    text: asString(value.text),
    exerciseType: exerciseType ?? 'multiple',
    options: asOptions(value.options),
    correctOptionId:
      typeof value.correctOptionId === 'string'
        ? value.correctOptionId
        : undefined,
    correctOptionIds: asStringArray(value.correctOptionIds),
    answer:
      typeof value.answer === 'string' ? value.answer : undefined,
    tolerance:
      typeof value.tolerance === 'number' && Number.isFinite(value.tolerance)
        ? value.tolerance
        : undefined,
    minWords:
      typeof value.minWords === 'number' && Number.isFinite(value.minWords)
        ? value.minWords
        : undefined,
    forbiddenConcepts: asForbiddenConcepts(value.forbiddenConcepts),
    pairs: asPairs(value.pairs),
  }
}

/**
 * Walks the module tree of a template and collects every exercise component by
 * id. The walk is depth-limited so a malformed document cannot hang a request.
 */
export function collectExerciseComponents(
  modules: unknown,
): Map<string, ExerciseComponent> {
  const components = new Map<string, ExerciseComponent>()

  const visit = (node: unknown, depth: number): void => {
    if (depth > 16 || !node || typeof node !== 'object') return

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }

    const component = toExerciseComponent(node)
    if (component) {
      components.set(component.id, component)
    }

    for (const child of Object.values(node)) {
      visit(child, depth + 1)
    }
  }

  visit(modules, 0)
  return components
}

/** FNV-1a over the serialized component, used as a preview cache version. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

export function hashComponent(component: ExerciseComponent): string {
  return fnv1a(JSON.stringify(component)).toString(36)
}

/**
 * Cache version of a template. The content document is timestamped, so every
 * edit produces a new version and invalidates the prepared exercises without
 * a manual purge.
 */
export function contentVersion(content: unknown): string {
  if (!isRecord(content)) return 'v1'

  const updatedAt = content.updatedAt
  if (updatedAt instanceof Date) return updatedAt.toISOString()
  if (typeof updatedAt === 'string' && updatedAt) return updatedAt

  return 'v1'
}
