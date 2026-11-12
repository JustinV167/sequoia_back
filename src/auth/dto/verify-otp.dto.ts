import { Transform } from 'class-transformer'
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator'

export class VerifyOtpDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255, { message: 'Email is too long.' })
  email!: string

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Enter the verification code.' })
  @Matches(/^\d{6}$/, { message: 'The code must be 6 digits.' })
  code!: string
}
