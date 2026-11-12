import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('MONGO_HOST', 'localhost')
        const port = config.get<string>('MONGO_PORT', '27017')
        const database = config.get<string>('MONGO_DB', 'sequoia')

        return {
          uri: `mongodb://${host}:${port}/${database}`,
          retryAttempts: 10,
          retryDelay: 3000,
        }
      },
    }),
  ],
})
export class MongoModule {}
