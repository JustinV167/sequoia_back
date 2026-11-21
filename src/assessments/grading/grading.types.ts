/** Exercise flavours shared with the course editor. */
export type ExerciseType =
  | 'multiple'
  | 'truefalse'
  | 'short'
  | 'fillblank'
  | 'ordering'
  | 'matching'
  | 'multiselect'
  | 'numeric'
  | 'essay'

export type ExerciseOption = {
  id: string
  text: string
}

export type ExercisePair = {
  id: string
  left: string
  right: string
}

/**
 * Subset of a course component the grader needs. The course content lives in
 * MongoDB as an opaque document, so every field is optional and `prepare`
 * falls back to safe defaults.
 */
export type ExerciseComponent = {
  id: string
  type?: string
  text?: string
  exerciseType?: ExerciseType
  options?: ExerciseOption[]
  correctOptionId?: string
  correctOptionIds?: string[]
  /** Accepted answer of a short, numeric or development exercise. */
  answer?: string
  /** Absolute margin accepted around the answer of a numeric exercise. */
  tolerance?: number
  /** Minimum length of a development answer. */
  minWords?: number
  /** Development concepts that must not appear, separated by ";". */
  forbiddenConcepts?: string
  pairs?: ExercisePair[]
}

/** What the student wrote or selected for one exercise. */
export type ExerciseAnswer = {
  optionIds: string[]
  text: string
  blanks: string[]
  order: string[]
  matches: Record<string, string>
}

export type ExerciseResultStatus = 'correct' | 'incorrect' | 'review'

/** Which part of the cascade decided the result. Useful for auditing. */
export type GradingStep =
  | 'exact'
  | 'tokens'
  | 'fuzzy'
  | 'numeric'
  | 'concepts'
  | 'length'
  | 'selection'
  | 'blank'
  | 'order'
  | 'match'
  | 'missing-reference'
  | 'missing-component'

export type ExerciseResult = {
  status: ExerciseResultStatus
  /** 0..1, used to report partial credit. */
  score: number
  /** One line shown under the result badge. */
  message: string
  /** Answers the student should have given, shown when they missed. */
  expected: string[]
  step: GradingStep
}

export type PreparedShortAlternative = {
  raw: string
  normalized: string
  tokens: Set<string>
}

export type PreparedConceptGroup = {
  /** First synonym, used in "Falta mencionar…" messages. */
  label: string
  /** Normalized synonyms of the group. */
  synonyms: string[]
}

/**
 * An exercise with every comparison precomputed: normalized alternatives,
 * token sets, numeric value and concept groups. Building it once per
 * component + template version keeps the grading path to string comparisons.
 */
export type PreparedExercise = {
  componentId: string
  type: ExerciseType
  correctOptionId: string | null
  correctOptionIds: string[]
  optionIds: string[]
  optionTextById: Map<string, string>
  pairIds: string[]
  pairLabels: string[]
  blankCount: number
  blankAnswers: string[]
  shortAlternatives: PreparedShortAlternative[]
  numericExpected: number | null
  numericAnswerText: string
  numericTolerance: number
  minWords: number
  conceptGroups: PreparedConceptGroup[]
  forbiddenConcepts: string[]
}
