import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'

import { SessionAuthGuard } from '../../auth/guards/session-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ResponseMessage } from '../../common/decorators/response-message.decorator'
import type { PublicUser } from '../../users/types/public-user.interface'
import { EnrollmentsService } from './enrollments.service'
import type {
  CourseStudentResponse,
  EnrollmentResponse,
} from './types/enrollment-response.interface'

@Controller()
@UseGuards(SessionAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Post('courses/:courseId/enrollments')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Enrollment created successfully.')
  enroll(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<EnrollmentResponse> {
    return this.enrollments.enroll(courseId, user)
  }

  @Get('courses/:courseId/students')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course students retrieved successfully.')
  students(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseStudentResponse[]> {
    return this.enrollments.listCourseStudents(courseId, user)
  }

  @Get('enrollments/me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Enrollments retrieved successfully.')
  listMine(@CurrentUser() user: PublicUser): Promise<EnrollmentResponse[]> {
    return this.enrollments.listMine(user)
  }
}
