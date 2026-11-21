import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { CourseTemplate } from './course-template.entity'
import { CourseTemplateRepository } from './course-template.repository'
import { CourseTemplatesController } from './course-templates.controller'
import { CourseTemplatesService } from './course-templates.service'
import { Course } from './course.entity'
import { CourseRepository } from './course.repository'
import { CoursesController } from './courses.controller'
import { CoursesService } from './courses.service'
import { Enrollment } from './enrollments/enrollment.entity'
import { EnrollmentRepository } from './enrollments/enrollment.repository'
import { CourseContentModule } from './templates/course-content.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, CourseTemplate, Enrollment]),
    AuthModule,
    CourseContentModule,
  ],
  controllers: [CoursesController, CourseTemplatesController],
  providers: [
    CourseRepository,
    CourseTemplateRepository,
    EnrollmentRepository,
    CoursesService,
    CourseTemplatesService,
  ],
  exports: [
    CourseRepository,
    CourseTemplateRepository,
    EnrollmentRepository,
  ],
})
export class CoursesModule {}
