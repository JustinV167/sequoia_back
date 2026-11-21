import type { CourseLevel } from '../enums/course-level.enum'
import type { CourseStatus } from '../enums/course-status.enum'
import type {
  CourseDesignContent,
  CourseModuleContent,
} from './course-content.types'

export interface CourseTeacherResponse {
  id: string
  fullName: string
}

export interface CourseResponse {
  id: string
  templateId: string | null
  title: string
  subject: string
  description: string
  level: CourseLevel
  durationMinutes: number | null
  coverUrl: string | null
  design: CourseDesignContent | null
  modules: CourseModuleContent[] | null
  status: CourseStatus
  teacher: CourseTeacherResponse
  studentsCount: number
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CourseSummaryResponse {
  id: string
  title: string
  subject: string
  description: string
  level: CourseLevel
  durationMinutes: number | null
  coverUrl: string | null
  status: CourseStatus
  teacher: CourseTeacherResponse
  studentsCount: number
}
