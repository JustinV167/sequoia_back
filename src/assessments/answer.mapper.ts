import type { ExerciseAnswerDto } from './dto/grade-attempt.dto'
import type { ExerciseAnswer } from './grading/grading.types'

/** Converts the validated request payload into the grading input. */
export function toExerciseAnswer(dto: ExerciseAnswerDto): ExerciseAnswer {
  const matches: Record<string, string> = {}

  if (dto.matches) {
    for (const [key, value] of Object.entries(dto.matches)) {
      if (typeof value === 'string') matches[key] = value
    }
  }

  return {
    optionIds: dto.optionIds ?? [],
    text: dto.text ?? '',
    blanks: dto.blanks ?? [],
    order: dto.order ?? [],
    matches,
  }
}
