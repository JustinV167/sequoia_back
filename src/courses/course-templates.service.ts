import { Injectable } from '@nestjs/common'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import type { PublicUser } from '../users/types/public-user.interface'
import { CourseTemplate } from './course-template.entity'
import { CourseTemplateRepository } from './course-template.repository'
import { Course } from './course.entity'
import { CourseRepository } from './course.repository'
import { CoursesService } from './courses.service'
import type { CreateCourseDto } from './dto/create-course.dto'
import type { PublishCourseTemplateDto } from './dto/publish-course-template.dto'
import type { UpdateCourseDto } from './dto/update-course.dto'
import { CourseStatus } from './enums/course-status.enum'
import { EnrollmentRepository } from './enrollments/enrollment.repository'
import type { CourseContentDocument } from './templates/course-content.schema'
import { CourseContentRepository } from './templates/course-content.repository'
import type { CourseResponse } from './types/course-response.interface'
import type {
  CoursePublicationSummaryResponse,
  CourseTemplateResponse,
} from './types/course-template-response.interface'
import { assertTeacher } from './utils/role-guards'

@Injectable()
export class CourseTemplatesService {
  constructor(
    private readonly templates: CourseTemplateRepository,
    private readonly contents: CourseContentRepository,
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly coursesService: CoursesService,
  ) {}

  async create(
    user: PublicUser,
    dto: CreateCourseDto,
  ): Promise<CourseTemplateResponse> {
    assertTeacher(user)

    const template = await this.templates.create({
      teacherId: user.id,
      title: dto.title,
      subject: dto.subject,
      description: dto.description ?? '',
      level: dto.level,
      durationMinutes: dto.durationMinutes ?? null,
      coverUrl: dto.coverUrl ?? null,
    })

    try {
      await this.contents.upsert(template.id, {
        design: dto.design ?? null,
        modules: dto.modules ?? null,
      })
    } catch (error) {
      await this.templates.deleteById(template.id).catch(() => undefined)
      throw error
    }

    return this.getById(template.id, user)
  }

  async listMine(user: PublicUser): Promise<CourseTemplateResponse[]> {
    assertTeacher(user)

    const templates = await this.templates.findByTeacherId(user.id)
    return this.withStats(templates)
  }

  async getById(
    id: string,
    user: PublicUser,
  ): Promise<CourseTemplateResponse> {
    const template = await this.findTemplateOrThrow(id)
    this.assertOwner(template, user.id)

    const [content, publications] = await Promise.all([
      this.contents.findByTemplateId(template.id),
      this.courses.findByTemplateIds([template.id]),
    ])
    const counts = await this.enrollments.countByCourseIds(
      publications.map((publication) => publication.id),
    )

    return this.toTemplateResponse(template, content, publications, counts)
  }

  async update(
    id: string,
    user: PublicUser,
    dto: UpdateCourseDto,
  ): Promise<CourseTemplateResponse> {
    assertTeacher(user)

    const template = await this.findTemplateOrThrow(id)
    this.assertOwner(template, user.id)

    if (dto.title !== undefined) template.title = dto.title
    if (dto.subject !== undefined) template.subject = dto.subject
    if (dto.description !== undefined) template.description = dto.description
    if (dto.level !== undefined) template.level = dto.level
    if (dto.durationMinutes !== undefined) {
      template.durationMinutes = dto.durationMinutes
    }
    if (dto.coverUrl !== undefined) template.coverUrl = dto.coverUrl

    await this.templates.save(template)

    // Keep publication metadata in sync so catalog and enrollment summaries
    // always show the latest template data. Custom publication titles are
    // preserved; only default titles follow the template.
    await this.courses.updateMetadataByTemplateId(template.id, {
      subject: template.subject,
      description: template.description,
      level: template.level,
      durationMinutes: template.durationMinutes,
      coverUrl: template.coverUrl,
    })
    await this.courses.updateDefaultTitleByTemplateId(
      template.id,
      template.title,
    )

    const contentUpdate: {
      design?: CreateCourseDto['design']
      modules?: CreateCourseDto['modules']
    } = {}

    if (dto.design !== undefined) contentUpdate.design = dto.design
    if (dto.modules !== undefined) contentUpdate.modules = dto.modules

    if (Object.keys(contentUpdate).length > 0) {
      await this.contents.upsert(template.id, contentUpdate)
    }

    return this.getById(template.id, user)
  }

  /**
   * Creates a new published course from the template. A template can be
   * published as many times as needed; every publication shares its content
   * but may use its own title (for example "Mate secc 2").
   */
  async publish(
    id: string,
    user: PublicUser,
    dto: PublishCourseTemplateDto = {},
  ): Promise<CourseResponse> {
    assertTeacher(user)

    const template = await this.findTemplateOrThrow(id)
    this.assertOwner(template, user.id)

    const requestedTitle = dto.title?.trim()
    const title = requestedTitle || template.title

    const publication = await this.courses.createPublication({
      templateId: template.id,
      teacherId: template.teacherId,
      title,
      titleOverridden: Boolean(
        requestedTitle && requestedTitle !== template.title,
      ),
      subject: template.subject,
      description: template.description,
      level: template.level,
      durationMinutes: template.durationMinutes,
      coverUrl: template.coverUrl,
      status: CourseStatus.Published,
      publishedAt: new Date(),
    })

    return this.coursesService.getById(publication.id, user)
  }

  async remove(id: string, user: PublicUser): Promise<void> {
    assertTeacher(user)

    const template = await this.findTemplateOrThrow(id)
    this.assertOwner(template, user.id)

    // Publications own enrollments; both are removed with the template.
    await this.courses.deleteByTemplateId(template.id)
    await this.contents.deleteByTemplateId(template.id)
    await this.templates.deleteById(template.id)
  }

  private async findTemplateOrThrow(id: string): Promise<CourseTemplate> {
    const template = await this.templates.findById(id)

    if (!template) {
      throw new AppException(
        404,
        ErrorCodes.CourseTemplateNotFound,
        'Course template not found.',
      )
    }

    return template
  }

  private assertOwner(template: CourseTemplate, userId: string): void {
    if (template.teacherId !== userId) {
      throw new AppException(
        403,
        ErrorCodes.CourseTemplateNotOwner,
        'You do not own this course template.',
      )
    }
  }

  private async withStats(
    templates: CourseTemplate[],
  ): Promise<CourseTemplateResponse[]> {
    const templateIds = templates.map((template) => template.id)
    const [contents, publications] = await Promise.all([
      this.contents.findByTemplateIds(templateIds),
      this.courses.findByTemplateIds(templateIds),
    ])
    const counts = await this.enrollments.countByCourseIds(
      publications.map((publication) => publication.id),
    )

    const publicationsByTemplate = new Map<string, Course[]>()
    for (const publication of publications) {
      if (!publication.templateId) continue

      const current = publicationsByTemplate.get(publication.templateId) ?? []
      current.push(publication)
      publicationsByTemplate.set(publication.templateId, current)
    }

    return templates.map((template) =>
      this.toTemplateResponse(
        template,
        contents.get(template.id) ?? null,
        publicationsByTemplate.get(template.id) ?? [],
        counts,
      ),
    )
  }

  private toTemplateResponse(
    template: CourseTemplate,
    content: CourseContentDocument | null,
    publications: Course[],
    counts: Map<string, number>,
  ): CourseTemplateResponse {
    const summaries: CoursePublicationSummaryResponse[] = publications.map(
      (publication) => ({
        id: publication.id,
        title: publication.title,
        status: publication.status,
        studentsCount: counts.get(publication.id) ?? 0,
        publishedAt: publication.publishedAt,
        createdAt: publication.createdAt,
      }),
    )

    const studentsCount = summaries.reduce(
      (total, publication) => total + publication.studentsCount,
      0,
    )
    const lastPublishedAt = summaries.reduce<Date | null>(
      (latest, publication) =>
        publication.status === CourseStatus.Published &&
        publication.publishedAt &&
        (!latest || publication.publishedAt > latest)
          ? publication.publishedAt
          : latest,
      null,
    )

    return {
      id: template.id,
      title: template.title,
      subject: template.subject,
      description: template.description,
      level: template.level,
      durationMinutes: template.durationMinutes,
      coverUrl: template.coverUrl,
      design: content?.design ?? null,
      modules: content?.modules ?? null,
      teacher: {
        id: template.teacher.id,
        fullName: template.teacher.fullName,
      },
      publications: summaries,
      studentsCount,
      lastPublishedAt,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }
  }
}
