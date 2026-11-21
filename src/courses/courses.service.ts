import { Injectable } from '@nestjs/common'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import type { PublicUser } from '../users/types/public-user.interface'
import type { CourseContentDocument } from './templates/course-content.schema'
import { CourseContentRepository } from './templates/course-content.repository'
import { Course } from './course.entity'
import { CourseStatus } from './enums/course-status.enum'
import { CourseRepository } from './course.repository'
import { EnrollmentRepository } from './enrollments/enrollment.repository'
import type { CourseResponse } from './types/course-response.interface'
import { assertTeacher } from './utils/role-guards'

@Injectable()
export class CoursesService {
  constructor(
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly contents: CourseContentRepository,
  ) {}

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

    const [counts, content] = await Promise.all([
      this.enrollments.countByCourseIds([course.id]),
      this.contentFor(course),
    ])

    return this.toCourseResponse(
      course,
      counts.get(course.id) ?? 0,
      content,
    )
  }

  async listByTemplate(
    templateId: string,
    user: PublicUser,
  ): Promise<CourseResponse[]> {
    assertTeacher(user)

    const publications = await this.courses.findByTemplateIds([templateId])
    const ownPublications = publications.filter(
      (publication) => publication.teacherId === user.id,
    )

    return this.withStudentsCount(ownPublications)
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

  async remove(id: string, user: PublicUser): Promise<void> {
    assertTeacher(user)

    const course = await this.findCourseOrThrow(id)
    this.assertOwner(course, user.id)

    // Content belongs to the template, not to the publication.
    await this.courses.deleteById(course.id)
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

  private async contentFor(
    course: Course,
  ): Promise<CourseContentDocument | null> {
    return this.contents.findByTemplateId(course.templateId ?? course.id)
  }

  private async withStudentsCount(
    courses: Course[],
  ): Promise<CourseResponse[]> {
    const courseIds = courses.map((course) => course.id)
    const templateIds = courses.map(
      (course) => course.templateId ?? course.id,
    )
    const [counts, contents] = await Promise.all([
      this.enrollments.countByCourseIds(courseIds),
      this.contents.findByTemplateIds(templateIds),
    ])

    return courses.map((course) =>
      this.toCourseResponse(
        course,
        counts.get(course.id) ?? 0,
        contents.get(course.templateId ?? course.id) ?? null,
      ),
    )
  }

  private toCourseResponse(
    course: Course,
    studentsCount: number,
    content: CourseContentDocument | null,
  ): CourseResponse {
    return {
      id: course.id,
      templateId: course.templateId,
      title: course.title,
      subject: course.subject,
      description: course.description,
      level: course.level,
      durationMinutes: course.durationMinutes,
      coverUrl: course.coverUrl,
      design: content?.design ?? null,
      modules: content?.modules ?? null,
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
