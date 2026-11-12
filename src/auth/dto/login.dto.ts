import { Transform } from 'class-transformer'
import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

import { UserRole } from '../../users/enums/user-role.enum'

export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255, { message: 'Email is too long.' })
  email!: string

  @IsString({ message: 'Enter your password.' })
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(128, { message: 'Password is too long.' })
  password!: string

  @IsEnum(UserRole, { message: 'Select a valid role.' })
  role!: UserRole
}
