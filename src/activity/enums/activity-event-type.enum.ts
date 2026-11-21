export enum ActivityEventType {
  CourseOpened = 'course_opened',
  CourseClosed = 'course_closed',
  ModuleViewed = 'module_viewed',
  LessonViewed = 'lesson_viewed',
  /** Time actively spent on a lesson, sent periodically in small deltas. */
  LessonTime = 'lesson_time',
  LessonCompleted = 'lesson_completed',
  VideoPlay = 'video_play',
  VideoPause = 'video_pause',
  VideoSeeked = 'video_seeked',
  VideoProgress = 'video_progress',
  VideoEnded = 'video_ended',
  ExerciseStarted = 'exercise_started',
  ExerciseAnswered = 'exercise_answered',
  ExerciseRetried = 'exercise_retried',
}
