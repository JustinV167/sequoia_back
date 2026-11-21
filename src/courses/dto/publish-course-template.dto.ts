import { Transform } from 'class-transformer'
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class PublishCourseTemplateDto {
  /**
   * Optional title for this publication only. When omitted, the template
   * title is used. Example: template "Matemática" -> "Mate secc 2".
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'Publication title must be a string.' })
  @IsNotEmpty({ message: 'Publication title is required.' })
  @MinLength(3, {
    message: 'Publication title must be at least 3 characters long.',
  })
  @MaxLength(160, { message: 'Publication title is too long.' })
  title?: string
}
