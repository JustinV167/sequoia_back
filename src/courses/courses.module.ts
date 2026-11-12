import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { Course } from './course.entity'
import { CourseRepository } from './course.repository'
import { CoursesController } from './courses.controller'
import { CoursesService } from './courses.service'
import { Enrollment } from './enrollments/enrollment.entity'
import { EnrollmentRepository } from './enrollments/enrollment.repository'
import { CourseTemplatesModule } from './templates/course-templates.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Enrollment]),
    AuthModule,
    CourseTemplatesModule,
  ],
  controllers: [CoursesController],
  providers: [CourseRepository, EnrollmentRepository, CoursesService],
  exports: [CourseRepository, EnrollmentRepository],
})
export class CoursesModule {}
