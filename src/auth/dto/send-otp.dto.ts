import { Transform } from 'class-transformer'
import { IsEmail, MaxLength } from 'class-validator'

export class SendOtpDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255, { message: 'Email is too long.' })
  email!: string
}
