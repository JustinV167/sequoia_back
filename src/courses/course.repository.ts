import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Course } from './course.entity'
import { CourseStatus } from './enums/course-status.enum'

export type CreateCourseData = Pick<
  Course,
  | 'teacherId'
  | 'title'
  | 'subject'
  | 'description'
  | 'level'
  | 'durationMinutes'
  | 'coverUrl'
>

@Injectable()
export class CourseRepository {
  constructor(
    @InjectRepository(Course)
    private readonly courses: Repository<Course>,
  ) {}

  async create(data: CreateCourseData): Promise<Course> {
    const course = this.courses.create({
      ...data,
      status: CourseStatus.Draft,
    })

    return this.courses.save(course)
  }

  async save(course: Course): Promise<Course> {
    return this.courses.save(course)
  }

  async findById(id: string): Promise<Course | null> {
    return this.courses.findOne({
      where: { id },
      relations: { teacher: true },
    })
  }

  async findPublished(): Promise<Course[]> {
    return this.courses.find({
      where: { status: CourseStatus.Published },
      relations: { teacher: true },
      order: { createdAt: 'DESC' },
    })
  }

  async findByTeacherId(teacherId: string): Promise<Course[]> {
    return this.courses.find({
      where: { teacherId },
      relations: { teacher: true },
      order: { createdAt: 'DESC' },
    })
  }

  async publish(id: string, publishedAt: Date): Promise<void> {
    await this.courses.update(
      { id },
      { status: CourseStatus.Published, publishedAt },
    )
  }

  async unpublish(id: string): Promise<void> {
    await this.courses.update(
      { id },
      { status: CourseStatus.Draft, publishedAt: null },
    )
  }

  async deleteById(id: string): Promise<void> {
    await this.courses.delete({ id })
  }
}
