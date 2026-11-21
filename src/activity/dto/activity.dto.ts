import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

import { ActivityEventType } from '../enums/activity-event-type.enum'

/** Upper bound for a single reported duration: one day in milliseconds. */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000
/** Upper bound for a media position or duration: seven days in seconds. */
const MAX_MEDIA_SECONDS = 7 * 24 * 60 * 60

/**
 * One interaction. Every field except `type` and `courseId` is optional so a
 * new event type can be added without breaking older clients.
 */
export class ActivityEventDto {
  /** Client-generated id used to make retries idempotent. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventId?: string

  @IsEnum(ActivityEventType)
  type!: ActivityEventType

  @IsUUID()
  courseId!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  moduleId?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lessonId?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  exerciseId?: string

  @IsOptional()
  @IsISO8601()
  occurredAt?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_DURATION_MS)
  durationMs?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MEDIA_SECONDS)
  positionSeconds?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MEDIA_SECONDS)
  durationSeconds?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number

  /** Normalised score (0..1) of an exercise attempt. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  score?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  attemptNumber?: number

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

export class TrackEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ActivityEventDto)
  events!: ActivityEventDto[]
}

export class ListActivityEventsQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  moduleId?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lessonId?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  exerciseId?: string

  @IsOptional()
  @IsEnum(ActivityEventType)
  type?: ActivityEventType

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}
