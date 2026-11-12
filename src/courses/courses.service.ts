import { Injectable } from '@nestjs/common'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import type { PublicUser } from '../users/types/public-user.interface'
import type { CreateCourseDto } from './dto/create-course.dto'
import type { UpdateCourseDto } from './dto/update-course.dto'
import { Course } from './course.entity'
import { CourseStatus } from './enums/course-status.enum'
import { CourseRepository } from './course.repository'
import { EnrollmentRepository } from './enrollments/enrollment.repository'
import type { CourseTemplateDocument } from './templates/course-template.schema'
import {
  CourseTemplateRepository,
  type CourseTemplateContent,
} from './templates/course-template.repository'
import type { CourseResponse } from './types/course-response.interface'
import { assertTeacher } from './utils/role-guards'

@Injectable()
export class CoursesService {
  constructor(
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly templates: CourseTemplateRepository,
  ) {}

  async create(
    user: PublicUser,
    dto: CreateCourseDto,
  ): Promise<CourseResponse> {
    assertTeacher(user)

    const course = await this.courses.create({
      teacherId: user.id,
      title: dto.title,
      subject: dto.subject,
      description: dto.description ?? '',
      level: dto.level,
      durationMinutes: dto.durationMinutes ?? null,
      coverUrl: dto.coverUrl ?? null,
    })

    try {
      await this.templates.upsert(course.id, {
        design: dto.design ?? null,
        modules: dto.modules ?? null,
      })
    } catch (error) {
      await this.courses.deleteById(course.id).catch(() => undefined)
      throw error
    }

    return this.getById(course.id, user)
  }

  async listCatalog(): Promise<CourseResponse[]> {
    const courses = await this.courses.findPublished()
    return this.withStudentsCount(courses)
  }

  async listMine(user: PublicUser): Promise<CourseResponse[]> {
    assertTeacher(user)

    const courses = await this.courses.findByTeacherId(user.id)
    return this.withStudentsCount(courses)
  }

  async getById(id: string, user: PublicUser): Promise<CourseResponse> {
    const course = await this.findCourseOrThrow(id)

    if (
      course.status !== CourseStatus.Published &&
      course.teacherId !== user.id
    ) {
      throw new AppException(
        404,
        ErrorCodes.CourseNotFound,
        'Course not found.',
      )
    }

    const [counts, template] = await Promise.all([
      this.enrollments.countByCourseIds([course.id]),
      this.templates.findByCourseId(course.id),
    ])

    return this.toCourseResponse(
      course,
      counts.get(course.id) ?? 0,
      template,
    )
  }

  async update(
    id: string,
    user: PublicUser,
    dto: UpdateCourseDto,
  ): Promise<CourseResponse> {
    assertTeacher(user)

    const course = await this.findCourseOrThrow(id)
    this.assertOwner(course, user.id)

    if (dto.title !== undefined) course.title = dto.title
    if (dto.subject !== undefined) course.subject = dto.subject
    if (dto.description !== undefined) course.description = dto.description
    if (dto.level !== undefined) course.level = dto.level
    if (dto.durationMinutes !== undefined) {
      course.durationMinutes = dto.durationMinutes
    }
    if (dto.coverUrl !== undefined) course.coverUrl = dto.coverUrl

    await this.courses.save(course)

    const templateUpdate: Partial<CourseTemplateContent> = {}
    if (dto.design !== undefined) templateUpdate.design = dto.design
    if (dto.modules !== undefined) templateUpdate.modules = dto.modules

    if (Object.keys(templateUpdate).length > 0) {
      await this.templates.upsert(course.id, templateUpdate)
    }

    return this.getById(course.id, user)
  }

  async unpublish(id: string, user: PublicUser): Promise<CourseResponse> {
    assertTeacher(user)

    const course = await this.findCourseOrThrow(id)
    this.assertOwner(course, user.id)

    if (course.status !== CourseStatus.Published) {
      throw new AppException(
        409,
        ErrorCodes.CourseInvalidStatus,
        'Only published courses can be unpublished.',
      )
    }

    await this.courses.unpublish(course.id)

    return this.getById(course.id, user)
  }

  async remove(id: string, user: PublicUser): Promise<void> {
    assertTeacher(user)

    const course = await this.findCourseOrThrow(id)
    this.assertOwner(course, user.id)

    await this.courses.deleteById(course.id)
    await this.templates.deleteByCourseId(course.id)
  }

  async publish(id: string, user: PublicUser): Promise<CourseResponse> {
    assertTeacher(user)

    const course = await this.findCourseOrThrow(id)
    this.assertOwner(course, user.id)

    if (course.status === CourseStatus.Published) {
      throw new AppException(
        409,
        ErrorCodes.CourseAlreadyPublished,
        'Course is already published.',
      )
    }

    if (course.status === CourseStatus.Archived) {
      throw new AppException(
        409,
        ErrorCodes.CourseInvalidStatus,
        'An archived course cannot be published.',
      )
    }

    await this.courses.publish(course.id, new Date())

    return this.getById(course.id, user)
  }

  private async findCourseOrThrow(id: string): Promise<Course> {
    const course = await this.courses.findById(id)

    if (!course) {
      throw new AppException(
        404,
        ErrorCodes.CourseNotFound,
        'Course not found.',
      )
    }

    return course
  }

  private assertOwner(course: Course, userId: string): void {
    if (course.teacherId !== userId) {
      throw new AppException(
        403,
        ErrorCodes.CourseNotOwner,
        'You do not own this course.',
      )
    }
  }

  private async withStudentsCount(
    courses: Course[],
  ): Promise<CourseResponse[]> {
    const courseIds = courses.map((course) => course.id)
    const [counts, templates] = await Promise.all([
      this.enrollments.countByCourseIds(courseIds),
      this.templates.findByCourseIds(courseIds),
    ])

    return courses.map((course) =>
      this.toCourseResponse(
        course,
        counts.get(course.id) ?? 0,
        templates.get(course.id) ?? null,
      ),
    )
  }

  private toCourseResponse(
    course: Course,
    studentsCount: number,
    template: CourseTemplateDocument | null,
  ): CourseResponse {
    return {
      id: course.id,
      title: course.title,
      subject: course.subject,
      description: course.description,
      level: course.level,
      durationMinutes: course.durationMinutes,
      coverUrl: course.coverUrl,
      design: template?.design ?? null,
      modules: template?.modules ?? null,
      status: course.status,
      teacher: {
        id: course.teacher.id,
        fullName: course.teacher.fullName,
      },
      studentsCount,
      publishedAt: course.publishedAt,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    }
  }
}
