import { Injectable } from '@nestjs/common'

import type {
  ExerciseComponent,
  PreparedExercise,
} from './grading/grading.types'
import { prepareExercise } from './grading/prepare-exercise'

/**
 * In-memory cache of prepared exercises keyed by `componentId:version`.
 *
 * The grading cascade only needs string comparisons; the expensive part is
 * normalizing the teacher's alternatives. Preparing each exercise once per
 * template version keeps attempts in the microsecond range.
 *
 * The cache is intentionally process-local: prepared data is derived and can
 * always be rebuilt from MongoDB.
 */
@Injectable()
export class PreparedExerciseCache {
  private readonly entries = new Map<string, PreparedExercise>()
  private readonly maxEntries = 5000

  get(component: ExerciseComponent, version: string): PreparedExercise {
    const key = `${component.id}:${version}`
    const cached = this.entries.get(key)

    if (cached) {
      // Refresh insertion order so the map behaves as an LRU.
      this.entries.delete(key)
      this.entries.set(key, cached)
      return cached
    }

    const prepared = prepareExercise(component)
    this.entries.set(key, prepared)

    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest) this.entries.delete(oldest)
    }

    return prepared
  }

  clear(): void {
    this.entries.clear()
  }

  get size(): number {
    return this.entries.size
  }
}
