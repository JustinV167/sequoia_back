import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.interface'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ResponseMessage } from '../common/decorators/response-message.decorator'
import { getClientMeta } from '../common/utils/client-meta'
import type { PublicUser } from '../users/types/public-user.interface'
import { ActivityService } from './activity.service'
import {
  ListActivityEventsQueryDto,
  TrackEventsDto,
} from './dto/activity.dto'
import type {
  ActivityEventResponse,
  CourseActivityBreakdownResponse,
  CourseActivitySummaryResponse,
  CourseStudentActivityResponse,
  MyCourseActivityResponse,
  StudentActivityDetailResponse,
  TrackEventsResponse,
} from './types/activity-response.interface'

@Controller('activity')
@UseGuards(SessionAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Activity recorded successfully.')
  track(
    @Body() dto: TrackEventsDto,
    @CurrentUser() user: PublicUser,
    @Req() request: Request,
  ): Promise<TrackEventsResponse> {
    const authenticated = request as AuthenticatedRequest

    return this.activity.track(
      user,
      authenticated.sessionId,
      dto,
      getClientMeta(request),
    )
  }

  @Get('courses/:courseId/me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Your activity was retrieved successfully.')
  mine(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<MyCourseActivityResponse> {
    return this.activity.getMyCourseActivity(user, courseId)
  }

  @Get('courses/:courseId/students')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course students activity retrieved successfully.')
  students(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseStudentActivityResponse[]> {
    return this.activity.getCourseStudents(user, courseId)
  }

  @Get('courses/:courseId/students/:studentId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Student activity retrieved successfully.')
  student(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<StudentActivityDetailResponse> {
    return this.activity.getStudentCourseActivity(user, courseId, studentId)
  }

  @Get('courses/:courseId/summary')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course activity summary retrieved successfully.')
  summary(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseActivitySummaryResponse> {
    return this.activity.getCourseSummary(user, courseId)
  }

  @Get('courses/:courseId/events')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course activity events retrieved successfully.')
  events(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: ListActivityEventsQueryDto,
    @CurrentUser() user: PublicUser,
  ): Promise<ActivityEventResponse[]> {
    return this.activity.getCourseEvents(user, courseId, query)
  }

  @Get('courses/:courseId/breakdown')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course activity breakdown retrieved successfully.')
  breakdown(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseActivityBreakdownResponse> {
    return this.activity.getCourseBreakdown(user, courseId)
  }
}
