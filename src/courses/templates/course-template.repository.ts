import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import type {
  CourseDesignContent,
  CourseModuleContent,
} from '../types/course-content.types'
import {
  CourseTemplate,
  type CourseTemplateDocument,
} from './course-template.schema'

export interface CourseTemplateContent {
  design: CourseDesignContent | null
  modules: CourseModuleContent[] | null
}

@Injectable()
export class CourseTemplateRepository {
  constructor(
    @InjectModel(CourseTemplate.name)
    private readonly templates: Model<CourseTemplateDocument>,
  ) {}

  async findByCourseId(
    courseId: string,
  ): Promise<CourseTemplateDocument | null> {
    return this.templates.findOne({ courseId }).exec()
  }

  async findByCourseIds(
    courseIds: string[],
  ): Promise<Map<string, CourseTemplateDocument>> {
    if (courseIds.length === 0) {
      return new Map()
    }

    const templates = await this.templates
      .find({ courseId: { $in: courseIds } })
      .exec()

    return new Map(templates.map((template) => [template.courseId, template]))
  }

  async upsert(
    courseId: string,
    content: Partial<CourseTemplateContent>,
  ): Promise<CourseTemplateDocument> {
    const update: Record<string, unknown> = {}

    if (content.design !== undefined) update.design = content.design
    if (content.modules !== undefined) update.modules = content.modules

    const updateDocument =
      Object.keys(update).length > 0
        ? { $set: update, $setOnInsert: { courseId } }
        : { $setOnInsert: { courseId } }

    const template = await this.templates
      .findOneAndUpdate({ courseId }, updateDocument, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .exec()

    if (!template) {
      throw new Error(`Could not save the course template for ${courseId}.`)
    }

    return template
  }

  async deleteByCourseId(courseId: string): Promise<void> {
    await this.templates.deleteOne({ courseId }).exec()
  }
}
