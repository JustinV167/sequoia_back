import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { CoursesModule } from '../courses/courses.module'
import { CourseContentModule } from '../courses/templates/course-content.module'
import { ActivityController } from './activity.controller'
import { ActivityService } from './activity.service'
import { ActivityEvent } from './entities/activity-event.entity'
import { CourseActivity } from './entities/course-activity.entity'
import { ExerciseActivity } from './entities/exercise-activity.entity'
import { LessonActivity } from './entities/lesson-activity.entity'
import { ModuleActivity } from './entities/module-activity.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivityEvent,
      CourseActivity,
      ModuleActivity,
      LessonActivity,
      ExerciseActivity,
    ]),
    AuthModule,
    CoursesModule,
    CourseContentModule,
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
