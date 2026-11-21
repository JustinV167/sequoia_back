import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ResponseMessage } from '../common/decorators/response-message.decorator'
import type { PublicUser } from '../users/types/public-user.interface'
import { QuizProgressDto } from './quiz.dto'
import { QuizService } from './quiz.service'
import type {
  QuizAttemptStateResponse,
  QuizInfoResponse,
  QuizStatsResponse,
} from './quiz-response.interface'

@Controller('quiz')
@UseGuards(SessionAuthGuard)
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get('courses/:courseId/lessons/:lessonId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Quiz information retrieved successfully.')
  info(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<QuizInfoResponse> {
    return this.quiz.getQuizInfo(user, courseId, lessonId)
  }

  @Get('courses/:courseId/lessons/:lessonId/stats')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Quiz statistics retrieved successfully.')
  stats(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<QuizStatsResponse> {
    return this.quiz.getQuizStats(user, courseId, lessonId)
  }

  @Post('courses/:courseId/lessons/:lessonId/start')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Quiz attempt started successfully.')
  start(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<QuizAttemptStateResponse> {
    return this.quiz.startAttempt(user, courseId, lessonId)
  }

  @Get('attempts/:attemptId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Quiz attempt retrieved successfully.')
  attempt(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<QuizAttemptStateResponse> {
    return this.quiz.getAttempt(user, attemptId)
  }

  @Put('attempts/:attemptId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Quiz progress saved successfully.')
  save(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: QuizProgressDto,
    @CurrentUser() user: PublicUser,
  ): Promise<QuizAttemptStateResponse> {
    return this.quiz.saveProgress(user, attemptId, dto)
  }

  @Post('attempts/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Quiz submitted successfully.')
  submit(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: QuizProgressDto,
    @CurrentUser() user: PublicUser,
  ): Promise<QuizAttemptStateResponse> {
    return this.quiz.submitAttempt(user, attemptId, dto)
  }
}
