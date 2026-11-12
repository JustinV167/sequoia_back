import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import {
  CourseTemplate,
  CourseTemplateSchema,
} from './course-template.schema'
import { CourseTemplateRepository } from './course-template.repository'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseTemplate.name, schema: CourseTemplateSchema },
    ]),
  ],
  providers: [CourseTemplateRepository],
  exports: [CourseTemplateRepository],
})
export class CourseTemplatesModule {}
