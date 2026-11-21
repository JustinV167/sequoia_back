import { Type } from 'class-transformer'
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

import { ExerciseAnswerDto } from './grade-attempt.dto'

/**
 * Teacher preview of a single exercise. It uses the exact same grading code as
 * a real attempt, so the editor can never show a different criterion.
 */
export class PreviewExerciseDto {
  @IsObject()
  component!: Record<string, unknown>

  @IsObject()
  @ValidateNested()
  @Type(() => ExerciseAnswerDto)
  answer!: ExerciseAnswerDto

  /** Optional cache version; derived from the component when absent. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  version?: string
}
