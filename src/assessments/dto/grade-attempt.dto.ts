import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator'

/** What the student sent for one exercise. */
export class ExerciseAnswerDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionIds?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blanks?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  order?: string[]

  @IsOptional()
  @IsObject()
  matches?: Record<string, string>
}

export class GradeAnswerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  componentId!: string

  @IsObject()
  @ValidateNested()
  @Type(() => ExerciseAnswerDto)
  answer!: ExerciseAnswerDto
}

/**
 * A whole lesson attempt in one request: the grader is CPU-only and resolves
 * every answer against the template stored in MongoDB.
 */
export class GradeAttemptDto {
  @IsUUID()
  templateId!: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GradeAnswerDto)
  answers!: GradeAnswerDto[]
}
