import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AssessmentsModule } from '../assessments/assessments.module'
import { AuthModule } from '../auth/auth.module'
import { CoursesModule } from '../courses/courses.module'
import { CourseContentModule } from '../courses/templates/course-content.module'
import { QuizAttempt } from './quiz-attempt.entity'
import { QuizController } from './quiz.controller'
import { QuizService } from './quiz.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([QuizAttempt]),
    AuthModule,
    CoursesModule,
    CourseContentModule,
    AssessmentsModule,
  ],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
