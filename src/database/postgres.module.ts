import { join } from 'node:path'

import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USER', 'sequoia'),
        password: config.get<string>('DB_PASSWORD', 'sequoia_pass'),
        database: config.get<string>('DB_NAME', 'sequoia'),
        autoLoadEntities: true,
        synchronize:
          config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
        migrationsRun:
          config.get<string>('DB_MIGRATIONS_RUN', 'true') === 'true',
        migrations: [join(__dirname, 'migrations/*{.js,.ts}')],
        migrationsTableName: 'typeorm_migrations',
        logging: config.get<string>('DB_LOGGING', 'false') === 'true',
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
  ],
})
export class PostgresModule {}
