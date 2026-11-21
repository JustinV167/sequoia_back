import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, QueryFailedError, Repository } from 'typeorm'

import { Enrollment } from './enrollment.entity'
import { EnrollmentStatus } from './enums/enrollment-status.enum'
import { EnrollmentAlreadyExistsError } from './errors/enrollment-already-exists.error'

export interface CreateEnrollmentData {
  courseId: string
  studentId: string
}

@Injectable()
export class EnrollmentRepository {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
  ) {}

  async create(data: CreateEnrollmentData): Promise<Enrollment> {
    try {
      const enrollment = this.enrollments.create({
        ...data,
        status: EnrollmentStatus.Active,
        progressPercent: 0,
      })

      return await this.enrollments.save(enrollment)
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = (
          error as QueryFailedError & {
            driverError?: { code?: string }
          }
        ).driverError

        if (driverError?.code === '23505') {
          throw new EnrollmentAlreadyExistsError()
        }
      }

      throw error
    }
  }

  async findByCourseAndStudent(
    courseId: string,
    studentId: string,
  ): Promise<Enrollment | null> {
    return this.enrollments.findOne({
      where: { courseId, studentId },
    })
  }

  async existsByCourseIdsAndStudent(
    courseIds: string[],
    studentId: string,
  ): Promise<boolean> {
    if (courseIds.length === 0) return false

    const count = await this.enrollments.count({
      where: { courseId: In(courseIds), studentId },
    })

    return count > 0
  }

  async findByStudentId(studentId: string): Promise<Enrollment[]> {
    return this.enrollments.find({
      where: { studentId },
      relations: { course: { teacher: true } },
      order: { enrolledAt: 'DESC' },
    })
  }

  async findByCourseId(courseId: string): Promise<Enrollment[]> {
    return this.enrollments.find({
      where: { courseId },
      relations: { student: true },
      order: { enrolledAt: 'ASC' },
    })
  }

  async countByCourseIds(courseIds: string[]): Promise<Map<string, number>> {
    if (courseIds.length === 0) {
      return new Map()
    }

    const rows = await this.enrollments
      .createQueryBuilder('enrollment')
      .select('enrollment.course_id', 'courseId')
      .addSelect('COUNT(*)', 'count')
      .where('enrollment.course_id IN (:...courseIds)', { courseIds })
      .groupBy('enrollment.course_id')
      .getRawMany<{ courseId: string; count: string }>()

    return new Map(
      rows.map((row) => [row.courseId, Number(row.count)] as const),
    )
  }
}
