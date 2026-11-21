import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose'

import type {
  CourseDesignContent,
  CourseModuleContent,
} from '../types/course-content.types'

/**
 * MongoDB document that owns the editable structure of a course template.
 * The PostgreSQL template row keeps the metadata; publications resolve their
 * content from this document so a single edit reaches every publication.
 *
 * The physical field is still called `courseId` to keep documents created
 * before the template/publication split compatible. It stores the template id.
 */
@Schema({
  collection: 'course_templates',
  timestamps: true,
  versionKey: false,
})
export class CourseContent {
  @Prop({ required: true, unique: true, index: true })
  courseId!: string

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  design!: CourseDesignContent | null

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  modules!: CourseModuleContent[] | null
}

export type CourseContentDocument = HydratedDocument<CourseContent>

export const CourseContentSchema = SchemaFactory.createForClass(CourseContent)
