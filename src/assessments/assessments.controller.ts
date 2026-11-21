import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ResponseMessage } from '../common/decorators/response-message.decorator'
import type { PublicUser } from '../users/types/public-user.interface'
import { AssessmentsService } from './assessments.service'
import { GradeAttemptDto } from './dto/grade-attempt.dto'
import { PrepareTemplateDto } from './dto/prepare-template.dto'
import { PreviewExerciseDto } from './dto/preview-exercise.dto'
import type {
  AttemptGradeResponse,
  PrepareTemplateResponse,
  PreviewGradeResponse,
} from './types/assessment-response.interface'

@Controller('assessments')
@UseGuards(SessionAuthGuard)
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Exercise graded successfully.')
  preview(
    @Body() dto: PreviewExerciseDto,
    @CurrentUser() user: PublicUser,
  ): PreviewGradeResponse {
    return this.assessments.preview(user, dto)
  }

  @Post('grade')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Attempt graded successfully.')
  grade(
    @Body() dto: GradeAttemptDto,
    @CurrentUser() user: PublicUser,
  ): Promise<AttemptGradeResponse> {
    return this.assessments.gradeAttempt(user, dto)
  }

  @Post('prepare')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Assessments prepared successfully.')
  prepare(
    @Body() dto: PrepareTemplateDto,
    @CurrentUser() user: PublicUser,
  ): Promise<PrepareTemplateResponse> {
    return this.assessments.prepareTemplate(user, dto)
  }
}
