/**
 * Levenshtein distance with a hard upper bound.
 *
 * The function stops as soon as it knows the distance is greater than
 * `maxDistance`, which keeps typo detection in the microsecond range for
 * answers of a few dozen characters.
 *
 * Returns `maxDistance + 1` when the distance exceeds the bound.
 */
export function boundedEditDistance(
  left: string,
  right: string,
  maxDistance: number,
): number {
  if (left === right) return 0
  if (maxDistance < 0) return 0

  // A length difference alone is enough to discard the pair.
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1
  }

  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  // Keep the inner loop as short as possible.
  let a = left
  let b = right
  if (b.length > a.length) {
    const swap = a
    a = b
    b = swap
  }

  const bLength = b.length
  let previous = new Array<number>(bLength + 1)
  let current = new Array<number>(bLength + 1)

  for (let index = 0; index <= bLength; index += 1) {
    previous[index] = index
  }

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row
    let rowMinimum = current[0]
    const rowCode = a.charCodeAt(row - 1)

    for (let column = 1; column <= bLength; column += 1) {
      const substitution =
        previous[column - 1] + (rowCode === b.charCodeAt(column - 1) ? 0 : 1)
      const insertion = current[column - 1] + 1
      const deletion = previous[column] + 1
      const value = Math.min(substitution, insertion, deletion)

      current[column] = value
      if (value < rowMinimum) rowMinimum = value
    }

    // Once a whole row is above the bound, no later row can come back down.
    if (rowMinimum > maxDistance) return maxDistance + 1

    const swap = previous
    previous = current
    current = swap
  }

  return previous[bLength]
}

/**
 * Typo budget by reference length. Short words are compared exactly so
 * "gato" never becomes "pato"; longer words tolerate one or two edits.
 */
export function maxErrorsFor(targetLength: number): number {
  if (targetLength <= 5) return 0
  if (targetLength <= 9) return 1
  return 2
}
