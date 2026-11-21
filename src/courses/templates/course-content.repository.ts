import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import type {
  CourseDesignContent,
  CourseModuleContent,
} from '../types/course-content.types'
import {
  CourseContent,
  type CourseContentDocument,
} from './course-content.schema'

export interface CourseContentPayload {
  design: CourseDesignContent | null
  modules: CourseModuleContent[] | null
}

@Injectable()
export class CourseContentRepository {
  constructor(
    @InjectModel(CourseContent.name)
    private readonly contents: Model<CourseContentDocument>,
  ) {}

  async findByTemplateId(
    templateId: string,
  ): Promise<CourseContentDocument | null> {
    return this.contents.findOne({ courseId: templateId }).exec()
  }

  async findByTemplateIds(
    templateIds: string[],
  ): Promise<Map<string, CourseContentDocument>> {
    if (templateIds.length === 0) {
      return new Map()
    }

    const contents = await this.contents
      .find({ courseId: { $in: templateIds } })
      .exec()

    return new Map(contents.map((content) => [content.courseId, content]))
  }

  async upsert(
    templateId: string,
    content: Partial<CourseContentPayload>,
  ): Promise<CourseContentDocument> {
    const update: Record<string, unknown> = {}

    if (content.design !== undefined) update.design = content.design
    if (content.modules !== undefined) update.modules = content.modules

    const updateDocument =
      Object.keys(update).length > 0
        ? { $set: update, $setOnInsert: { courseId: templateId } }
        : { $setOnInsert: { courseId: templateId } }

    const saved = await this.contents
      .findOneAndUpdate({ courseId: templateId }, updateDocument, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .exec()

    if (!saved) {
      throw new Error(`Could not save the content for template ${templateId}.`)
    }

    return saved
  }

  async deleteByTemplateId(templateId: string): Promise<void> {
    await this.contents.deleteOne({ courseId: templateId }).exec()
  }
}
