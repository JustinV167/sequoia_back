import { Transform } from 'class-transformer'
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'

export class ResetPasswordDto {
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

  @IsString({ message: 'Enter a password.' })
  @IsNotEmpty({ message: 'Enter a password.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(128, { message: 'Password is too long.' })
  password!: string
}
