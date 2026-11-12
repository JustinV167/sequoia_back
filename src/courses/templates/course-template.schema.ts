import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose'

import type {
  CourseDesignContent,
  CourseModuleContent,
} from '../types/course-content.types'

/**
 * MongoDB document that owns the editable course structure. The PostgreSQL
 * course row only keeps the metadata and the relationship with its teacher.
 */
@Schema({
  collection: 'course_templates',
  timestamps: true,
  versionKey: false,
})
export class CourseTemplate {
  @Prop({ required: true, unique: true, index: true })
  courseId!: string

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  design!: CourseDesignContent | null

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  modules!: CourseModuleContent[] | null
}

export type CourseTemplateDocument = HydratedDocument<CourseTemplate>

export const CourseTemplateSchema = SchemaFactory.createForClass(CourseTemplate)
