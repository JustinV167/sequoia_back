import type { CourseStatus } from '../enums/course-status.enum'
import type { CourseTeacherResponse } from './course-response.interface'
import type { CourseLevel } from '../enums/course-level.enum'
import type {
  CourseDesignContent,
  CourseModuleContent,
} from './course-content.types'

export interface CoursePublicationSummaryResponse {
  id: string
  title: string
  status: CourseStatus
  studentsCount: number
  publishedAt: Date | null
  createdAt: Date
}

export interface CourseTemplateResponse {
  id: string
  title: string
  subject: string
  description: string
  level: CourseLevel
  durationMinutes: number | null
  coverUrl: string | null
  design: CourseDesignContent | null
  modules: CourseModuleContent[] | null
  teacher: CourseTeacherResponse
  publications: CoursePublicationSummaryResponse[]
  studentsCount: number
  lastPublishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
