import { join } from 'node:path'

import 'reflect-metadata'
import { config as loadEnv } from 'dotenv'
import { DataSource } from 'typeorm'

import { Session } from '../auth/sessions/session.entity'
import { VerificationCode } from '../auth/verification/verification-code.entity'
import { Course } from '../courses/course.entity'
import { Enrollment } from '../courses/enrollments/enrollment.entity'
import { User } from '../users/user.entity'

loadEnv({
  path: [
    join(__dirname, '../../../../.env'),
    join(process.cwd(), '../../.env'),
    join(process.cwd(), '.env'),
  ],
  quiet: true,
})

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'sequoia',
  password: process.env.DB_PASSWORD ?? 'sequoia_pass',
  database: process.env.DB_NAME ?? 'sequoia',
  entities: [User, VerificationCode, Session, Course, Enrollment],
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
})

export default AppDataSource
