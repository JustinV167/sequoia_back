import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { CourseContent, CourseContentSchema } from './course-content.schema'
import { CourseContentRepository } from './course-content.repository'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseContent.name, schema: CourseContentSchema },
    ]),
  ],
  providers: [CourseContentRepository],
  exports: [CourseContentRepository],
})
export class CourseContentModule {}
