import { Injectable } from '@nestjs/common'

import { ErrorCodes } from '../../common/constants/error-codes'
import { AppException } from '../../common/exceptions/app.exception'
import type { PublicUser } from '../../users/types/public-user.interface'
import { Course } from '../course.entity'
import { CourseRepository } from '../course.repository'
import { CourseStatus } from '../enums/course-status.enum'
import type { CourseSummaryResponse } from '../types/course-response.interface'
import { assertStudent, assertTeacher } from '../utils/role-guards'
import { Enrollment } from './enrollment.entity'
import { EnrollmentRepository } from './enrollment.repository'
import { EnrollmentAlreadyExistsError } from './errors/enrollment-already-exists.error'
import type {
  CourseStudentResponse,
  EnrollmentResponse,
} from './types/enrollment-response.interface'

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
  ) {}

  async enroll(
    courseId: string,
    user: PublicUser,
  ): Promise<EnrollmentResponse> {
    assertStudent(user)

    const course = await this.findCourseOrThrow(courseId)

    if (course.status !== CourseStatus.Published) {
      throw new AppException(
        409,
        ErrorCodes.CourseNotPublished,
        'This course is not open for enrollment.',
      )
    }

    const existing = await this.enrollments.findByCourseAndStudent(
      courseId,
      user.id,
    )

    if (existing) {
      throw this.alreadyEnrolled()
    }

    let enrollment: Enrollment

    try {
      enrollment = await this.enrollments.create({
        courseId,
        studentId: user.id,
      })
    } catch (error) {
      if (error instanceof EnrollmentAlreadyExistsError) {
        throw this.alreadyEnrolled()
      }

      throw error
    }

    const counts = await this.enrollments.countByCourseIds([course.id])

    return this.toEnrollmentResponse(
      enrollment,
      this.toCourseSummary(course, counts.get(course.id) ?? 0),
    )
  }

  async listMine(user: PublicUser): Promise<EnrollmentResponse[]> {
    assertStudent(user)

    const enrollments = await this.enrollments.findByStudentId(user.id)
    const counts = await this.enrollments.countByCourseIds(
      [...new Set(enrollments.map((enrollment) => enrollment.courseId))],
    )

    return enrollments.map((enrollment) =>
      this.toEnrollmentResponse(
        enrollment,
        this.toCourseSummary(
          enrollment.course,
          counts.get(enrollment.courseId) ?? 0,
        ),
      ),
    )
  }

  async listCourseStudents(
    courseId: string,
    user: PublicUser,
  ): Promise<CourseStudentResponse[]> {
    assertTeacher(user)

    const course = await this.findCourseOrThrow(courseId)
    this.assertOwner(course, user.id)

    const enrollments = await this.enrollments.findByCourseId(courseId)

    return enrollments.map((enrollment) => ({
      id: enrollment.id,
      studentId: enrollment.studentId,
      status: enrollment.status,
      progressPercent: enrollment.progressPercent,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      student: {
        id: enrollment.student.id,
        fullName: enrollment.student.fullName,
        email: enrollment.student.email,
      },
    }))
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

  private alreadyEnrolled(): AppException {
    return new AppException(
      409,
      ErrorCodes.EnrollmentAlreadyExists,
      'You are already enrolled in this course.',
    )
  }

  private toEnrollmentResponse(
    enrollment: Enrollment,
    course: CourseSummaryResponse,
  ): EnrollmentResponse {
    return {
      id: enrollment.id,
      courseId: enrollment.courseId,
      studentId: enrollment.studentId,
      status: enrollment.status,
      progressPercent: enrollment.progressPercent,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      course,
    }
  }

  private toCourseSummary(
    course: Course,
    studentsCount: number,
  ): CourseSummaryResponse {
    return {
      id: course.id,
      title: course.title,
      subject: course.subject,
      description: course.description,
      level: course.level,
      durationMinutes: course.durationMinutes,
      coverUrl: course.coverUrl,
      status: course.status,
      teacher: {
        id: course.teacher.id,
        fullName: course.teacher.fullName,
      },
      studentsCount,
    }
  }
}
