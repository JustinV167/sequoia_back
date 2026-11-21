import { Transform } from 'class-transformer'
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

import { UserRole } from '../../users/enums/user-role.enum'

export class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Invalid registration token.' })
  @IsNotEmpty({ message: 'Registration token is required.' })
  registrationToken!: string

  @IsEnum(UserRole, { message: 'Select a valid role.' })
  role!: UserRole

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Enter your full name.' })
  @MinLength(2, { message: 'Name must be at least 2 characters long.' })
  @MaxLength(120, { message: 'Name is too long.' })
  fullName!: string

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255, { message: 'Email is too long.' })
  email!: string

  @IsOptional()
  @IsString({ message: 'Enter a password.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(128, { message: 'Password is too long.' })
  password?: string
}
