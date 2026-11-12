import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

import { CourseLevel } from '../enums/course-level.enum'
import type {
  CourseDesignContent,
  CourseModuleContent,
} from '../types/course-content.types'

export class UpdateCourseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'Enter the course title.' })
  @IsNotEmpty({ message: 'Course title is required.' })
  @MinLength(3, { message: 'Course title must be at least 3 characters long.' })
  @MaxLength(160, { message: 'Course title is too long.' })
  title?: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'Enter the course subject.' })
  @IsNotEmpty({ message: 'Course subject is required.' })
  @MaxLength(100, { message: 'Course subject is too long.' })
  subject?: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'Course description must be a string.' })
  @MaxLength(5000, { message: 'Course description is too long.' })
  description?: string

  @IsOptional()
  @IsEnum(CourseLevel, { message: 'Select a valid course level.' })
  level?: CourseLevel

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Course duration must be a whole number of minutes.' })
  @Min(0, { message: 'Course duration cannot be negative.' })
  @Max(100000, { message: 'Course duration is too long.' })
  durationMinutes?: number

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString({ message: 'Course cover must be a string.' })
  @MaxLength(500, { message: 'Course cover is too long.' })
  coverUrl?: string

  @IsOptional()
  @IsObject({ message: 'Course design must be an object.' })
  design?: CourseDesignContent

  @IsOptional()
  @IsArray({ message: 'Course modules must be an array.' })
  @IsObject({ each: true, message: 'Each course module must be an object.' })
  modules?: CourseModuleContent[]
}
