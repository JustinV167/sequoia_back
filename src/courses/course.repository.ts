import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Course } from './course.entity'
import { CourseStatus } from './enums/course-status.enum'

export type CreateCoursePublicationData = Pick<
  Course,
  | 'teacherId'
  | 'templateId'
  | 'title'
  | 'subject'
  | 'description'
  | 'level'
  | 'durationMinutes'
  | 'coverUrl'
> & {
  status?: CourseStatus
  publishedAt?: Date | null
  titleOverridden?: boolean
}

export type UpdateCourseMetadataData = Partial<
  Pick<
    Course,
    'subject' | 'description' | 'level' | 'durationMinutes' | 'coverUrl'
  >
>

@Injectable()
export class CourseRepository {
  constructor(
    @InjectRepository(Course)
    private readonly courses: Repository<Course>,
  ) {}

  async createPublication(
    data: CreateCoursePublicationData,
  ): Promise<Course> {
    const course = this.courses.create({
      ...data,
      status: data.status ?? CourseStatus.Published,
      publishedAt: data.publishedAt ?? new Date(),
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
      order: { publishedAt: 'DESC' },
    })
  }

  async findByTeacherId(teacherId: string): Promise<Course[]> {
    return this.courses.find({
      where: { teacherId },
      relations: { teacher: true },
      order: { createdAt: 'DESC' },
    })
  }

  async findByTemplateIds(templateIds: string[]): Promise<Course[]> {
    if (templateIds.length === 0) {
      return []
    }

    return this.courses.find({
      where: templateIds.map((templateId) => ({ templateId })),
      relations: { teacher: true },
      order: { publishedAt: 'DESC' },
    })
  }

  async updateMetadataByTemplateId(
    templateId: string,
    data: UpdateCourseMetadataData,
  ): Promise<void> {
    await this.courses.update({ templateId }, data)
  }

  /**
   * Template title edits only reach publications that never had a custom
   * title. Publications published as "Mate secc 2" keep their own title.
   */
  async updateDefaultTitleByTemplateId(
    templateId: string,
    title: string,
  ): Promise<void> {
    await this.courses.update(
      { templateId, titleOverridden: false },
      { title },
    )
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

  async deleteByTemplateId(templateId: string): Promise<void> {
    await this.courses.delete({ templateId })
  }
}
