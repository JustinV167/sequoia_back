import { IsUUID } from 'class-validator'

/** Warms the prepared-exercise cache for a whole template. */
export class PrepareTemplateDto {
  @IsUUID()
  templateId!: string
}
