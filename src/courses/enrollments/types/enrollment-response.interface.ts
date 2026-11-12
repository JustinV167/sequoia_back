import type { CourseSummaryResponse } from '../../types/course-response.interface'
import type { EnrollmentStatus } from '../enums/enrollment-status.enum'

export interface EnrollmentResponse {
  id: string
  courseId: string
  studentId: string
  status: EnrollmentStatus
  progressPercent: number
  enrolledAt: Date
  completedAt: Date | null
  course: CourseSummaryResponse
}

export interface CourseStudentResponse {
  id: string
  studentId: string
  status: EnrollmentStatus
  progressPercent: number
  enrolledAt: Date
  completedAt: Date | null
  student: {
    id: string
    fullName: string
    email: string
  }
}
