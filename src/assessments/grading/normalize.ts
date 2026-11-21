/**
 * Shared normalizer used by every deterministic grading step.
 *
 * The order of the transformations matters: NFD splits accented characters so
 * the combining marks can be removed, and only then the text is lowercased and
 * stripped of punctuation. That makes "  ¿Mercurio? " and "mercurio" the same
 * answer.
 */
export function normalizeAnswerText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:'"`´()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Words that do not change the meaning of a short answer. Negations are
 * deliberately NOT stop words: dropping "no" would make "mercurio no es un
 * planeta" look like "mercurio planeta" and accept a wrong answer.
 */
const STOP_WORDS = new Set([
  'a',
  'al',
  'algo',
  'algun',
  'alguna',
  'algunas',
  'algunos',
  'ante',
  'antes',
  'como',
  'con',
  'contra',
  'cual',
  'cuales',
  'cuando',
  'de',
  'del',
  'desde',
  'donde',
  'dos',
  'el',
  'ella',
  'ellas',
  'ellos',
  'en',
  'entre',
  'era',
  'eran',
  'eras',
  'eres',
  'es',
  'esa',
  'esas',
  'ese',
  'eso',
  'esos',
  'esta',
  'estaba',
  'estado',
  'estas',
  'este',
  'esto',
  'estos',
  'fue',
  'fueron',
  'ha',
  'habia',
  'habian',
  'han',
  'hasta',
  'hay',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'mas',
  'me',
  'mi',
  'mis',
  'mucho',
  'muy',
  'nada',
  'nos',
  'nosotros',
  'o',
  'os',
  'otra',
  'otras',
  'otro',
  'otros',
  'para',
  'pero',
  'poco',
  'por',
  'porque',
  'que',
  'quien',
  'quienes',
  'se',
  'sea',
  'segun',
  'ser',
  'si',
  'sin',
  'sobre',
  'son',
  'su',
  'sus',
  'tambien',
  'tanto',
  'te',
  'tener',
  'tiene',
  'tienen',
  'todo',
  'todos',
  'tu',
  'tus',
  'un',
  'una',
  'unas',
  'uno',
  'unos',
  'usted',
  'ustedes',
  'y',
  'ya',
  'yo',
])

/** Very light Spanish singularization (-ces → -z, -es, -s). */
function singularize(token: string): string {
  if (token.length <= 4) return token
  if (token.endsWith('ces')) return `${token.slice(0, -3)}z`
  if (token.endsWith('es')) return token.slice(0, -2)
  if (token.endsWith('s')) return token.slice(0, -1)
  return token
}

/**
 * Meaningful words of an answer: normalized, without stop words and with a
 * light singular form. Used to compare answers whose words are in any order.
 */
export function tokenizeAnswer(value: string): string[] {
  const normalized = normalizeAnswerText(value)
  if (!normalized) return []

  return normalized
    .split(' ')
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .map(singularize)
}

export function tokenSet(value: string): Set<string> {
  return new Set(tokenizeAnswer(value))
}

/** Exact set equality; order and repetitions do not matter. */
export function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false

  for (const item of left) {
    if (!right.has(item)) return false
  }

  return true
}

/** Accepted short answers, separated by ";" (a "|" is also tolerated). */
export function splitAlternatives(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * Development concept groups: groups separated by ";", synonyms inside a
 * group by "|". For example "fotosíntesis|síntesis clorofílica; clorofila".
 */
export function splitConceptGroups(
  value: string | undefined,
): { label: string; synonyms: string[] }[] {
  return (value ?? '')
    .split(';')
    .map((group) =>
      group
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .filter((group) => group.length > 0)
    .map((group) => ({
      label: group[0],
      synonyms: group
        .map((synonym) => normalizeAnswerText(synonym))
        .filter(Boolean),
    }))
}

/** Whole-word / whole-phrase match inside an already normalized text. */
export function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false
  return ` ${haystack} `.includes(` ${needle} `)
}

export function countWords(value: string): number {
  const trimmed = value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/**
 * Reads "1.234,5", "1,234.5", "-3", "3/4" or " 42 " as a number. Returns null
 * when the text is not a number.
 */
export function parseAnswerNumber(value: string): number | null {
  const cleaned = value.replace(/\s/g, '')
  if (!cleaned) return null

  const fraction = cleaned.match(
    /^(-?\d+(?:[.,]\d+)?)\/(-?\d+(?:[.,]\d+)?)$/,
  )
  if (fraction) {
    const numerator = parseAnswerNumber(fraction[1])
    const denominator = parseAnswerNumber(fraction[2])
    if (numerator == null || denominator == null || denominator === 0) {
      return null
    }
    return numerator / denominator
  }

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized = cleaned

  if (lastComma >= 0 && lastDot >= 0) {
    // The separator further to the right is the decimal one.
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '')
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(',', '.')
  }

  const number = Number.parseFloat(normalized)
  return Number.isFinite(number) ? number : null
}
