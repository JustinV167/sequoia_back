import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { CoursesModule } from '../courses/courses.module'
import { CourseContentModule } from '../courses/templates/course-content.module'
import { AssessmentsController } from './assessments.controller'
import { AssessmentsService } from './assessments.service'
import { PreparedExerciseCache } from './prepared-exercise.cache'

@Module({
  imports: [AuthModule, CoursesModule, CourseContentModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, PreparedExerciseCache],
})
export class AssessmentsModule {}
