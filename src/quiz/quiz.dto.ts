import { Type } from 'class-transformer'
import {
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
} from 'class-validator'

/**
 * Autosave / submit payload. `answers` is a map of componentId → answer; the
 * service sanitises every entry against the quiz definition before storing it.
 */
export class QuizProgressDto {
  @IsObject()
  answers!: Record<string, unknown>

  /** Cumulative soft anti-cheat counters, chosen by the client. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  focusLostCount?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(7 * 24 * 60 * 60)
  tabHiddenSeconds?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  pasteCount?: number
}
