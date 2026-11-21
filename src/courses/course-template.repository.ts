import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { CourseTemplate } from './course-template.entity'

export type CreateCourseTemplateData = Pick<
  CourseTemplate,
  | 'teacherId'
  | 'title'
  | 'subject'
  | 'description'
  | 'level'
  | 'durationMinutes'
  | 'coverUrl'
>

export type UpdateCourseTemplateData = Partial<
  Pick<
    CourseTemplate,
    'title' | 'subject' | 'description' | 'level' | 'durationMinutes' | 'coverUrl'
  >
>

@Injectable()
export class CourseTemplateRepository {
  constructor(
    @InjectRepository(CourseTemplate)
    private readonly templates: Repository<CourseTemplate>,
  ) {}

  async create(data: CreateCourseTemplateData): Promise<CourseTemplate> {
    const template = this.templates.create(data)

    return this.templates.save(template)
  }

  async save(template: CourseTemplate): Promise<CourseTemplate> {
    return this.templates.save(template)
  }

  async findById(id: string): Promise<CourseTemplate | null> {
    return this.templates.findOne({
      where: { id },
      relations: { teacher: true },
    })
  }

  async findByTeacherId(teacherId: string): Promise<CourseTemplate[]> {
    return this.templates.find({
      where: { teacherId },
      relations: { teacher: true },
      order: { createdAt: 'DESC' },
    })
  }

  async updateMetadata(id: string, data: UpdateCourseTemplateData): Promise<void> {
    await this.templates.update({ id }, data)
  }

  async deleteById(id: string): Promise<void> {
    await this.templates.delete({ id })
  }
}
