import { Injectable } from '@nestjs/common'

import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import { CourseTemplate } from '../courses/course-template.entity'
import { CourseTemplateRepository } from '../courses/course-template.repository'
import { CourseRepository } from '../courses/course.repository'
import { CourseStatus } from '../courses/enums/course-status.enum'
import { EnrollmentRepository } from '../courses/enrollments/enrollment.repository'
import { CourseContentRepository } from '../courses/templates/course-content.repository'
import { assertTeacher } from '../courses/utils/role-guards'
import type { PublicUser } from '../users/types/public-user.interface'
import { toExerciseAnswer } from './answer.mapper'
import {
  collectExerciseComponents,
  contentVersion,
  hashComponent,
  toExerciseComponent,
} from './component'
import type { GradeAttemptDto } from './dto/grade-attempt.dto'
import type { PrepareTemplateDto } from './dto/prepare-template.dto'
import type { PreviewExerciseDto } from './dto/preview-exercise.dto'
import { gradeExercise } from './grading/grade-exercise'
import { reviewResult } from './grading/result'
import { PreparedExerciseCache } from './prepared-exercise.cache'
import type {
  AttemptGradeResponse,
  GradedExerciseResponse,
  PrepareTemplateResponse,
  PreviewGradeResponse,
} from './types/assessment-response.interface'

function elapsedMilliseconds(startedAt: bigint): number {
  return Number((process.hrtime.bigint() - startedAt) / 1000n) / 1000
}

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly templates: CourseTemplateRepository,
    private readonly courses: CourseRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly contents: CourseContentRepository,
    private readonly cache: PreparedExerciseCache,
  ) {}

  /**
   * Teacher preview of one exercise. Same code as a real attempt, no database
   * write: the editor can show exactly what the student will get.
   */
  preview(
    user: PublicUser,
    dto: PreviewExerciseDto,
  ): PreviewGradeResponse {
    assertTeacher(user)

    const component = toExerciseComponent(dto.component)

    if (!component) {
      throw new AppException(
        400,
        ErrorCodes.AssessmentInvalidComponent,
        'The exercise payload is not valid.',
      )
    }

    const startedAt = process.hrtime.bigint()
    const version = dto.version ?? hashComponent(component)
    const prepared = this.cache.get(component, version)
    const result = gradeExercise(prepared, toExerciseAnswer(dto.answer))

    return {
      componentId: component.id,
      version,
      elapsedMs: elapsedMilliseconds(startedAt),
      result,
    }
  }

  /**
   * Grades every answer of a lesson in a single request. The exercise
   * definitions come from the template in MongoDB; the client only sends the
   * component ids and the student's answers.
   */
  async gradeAttempt(
    user: PublicUser,
    dto: GradeAttemptDto,
  ): Promise<AttemptGradeResponse> {
    const startedAt = process.hrtime.bigint()
    const template = await this.findTemplateOrThrow(dto.templateId)
    await this.assertCanGrade(template, user)

    const content = await this.contents.findByTemplateId(template.id)

    if (!content) {
      throw new AppException(
        404,
        ErrorCodes.AssessmentNotFound,
        'The assessment content was not found.',
      )
    }

    const version = contentVersion(content)
    const components = collectExerciseComponents(content.modules)

    const results: GradedExerciseResponse[] = dto.answers.map(
      ({ componentId, answer }) => {
        const component = components.get(componentId)

        if (!component) {
          return {
            componentId,
            result: reviewResult(
              'La pregunta no está disponible en esta versión del curso.',
              'missing-component',
            ),
          }
        }

        const prepared = this.cache.get(component, version)

        return {
          componentId,
          result: gradeExercise(prepared, toExerciseAnswer(answer)),
        }
      },
    )

    return this.summarize(template.id, version, results, startedAt)
  }

  /**
   * Warms the cache for a template. Intended to be called after publishing so
   * the first student attempt is already prepared.
   */
  async prepareTemplate(
    user: PublicUser,
    dto: PrepareTemplateDto,
  ): Promise<PrepareTemplateResponse> {
    assertTeacher(user)

    const template = await this.findTemplateOrThrow(dto.templateId)

    if (template.teacherId !== user.id) {
      throw new AppException(
        403,
        ErrorCodes.CourseTemplateNotOwner,
        'You do not own this course template.',
      )
    }

    const content = await this.contents.findByTemplateId(template.id)

    if (!content) {
      throw new AppException(
        404,
        ErrorCodes.AssessmentNotFound,
        'The assessment content was not found.',
      )
    }

    const startedAt = process.hrtime.bigint()
    const version = contentVersion(content)
    const components = collectExerciseComponents(content.modules)

    for (const component of components.values()) {
      this.cache.get(component, version)
    }

    return {
      templateId: template.id,
      version,
      exercises: components.size,
      elapsedMs: elapsedMilliseconds(startedAt),
    }
  }

  private async findTemplateOrThrow(id: string): Promise<CourseTemplate> {
    const template = await this.templates.findById(id)

    if (!template) {
      throw new AppException(
        404,
        ErrorCodes.AssessmentNotFound,
        'The assessment template was not found.',
      )
    }

    return template
  }

  /**
   * The template owner can always grade (useful while editing). A student must
   * be enrolled in at least one published course created from the template.
   */
  private async assertCanGrade(
    template: CourseTemplate,
    user: PublicUser,
  ): Promise<void> {
    if (template.teacherId === user.id) return

    const publications = await this.courses.findByTemplateIds([template.id])
    const publishedCourseIds = publications
      .filter((publication) => publication.status === CourseStatus.Published)
      .map((publication) => publication.id)

    if (publishedCourseIds.length === 0) {
      throw new AppException(
        403,
        ErrorCodes.AssessmentNotAvailable,
        'This assessment is not available.',
      )
    }

    const enrolled = await this.enrollments.existsByCourseIdsAndStudent(
      publishedCourseIds,
      user.id,
    )

    if (!enrolled) {
      throw new AppException(
        403,
        ErrorCodes.AssessmentNotAvailable,
        'Enroll in the course to answer its assessments.',
      )
    }
  }

  private summarize(
    templateId: string,
    version: string,
    results: GradedExerciseResponse[],
    startedAt: bigint,
  ): AttemptGradeResponse {
    let correct = 0
    let incorrect = 0
    let review = 0
    let score = 0

    for (const { result } of results) {
      if (result.status === 'correct') correct += 1
      else if (result.status === 'incorrect') incorrect += 1
      else review += 1

      score += result.score
    }

    return {
      templateId,
      version,
      total: results.length,
      correct,
      incorrect,
      review,
      score: results.length > 0 ? score / results.length : 0,
      elapsedMs: elapsedMilliseconds(startedAt),
      results,
    }
  }
}
