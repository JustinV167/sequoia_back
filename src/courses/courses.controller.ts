import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ResponseMessage } from '../common/decorators/response-message.decorator'
import type { PublicUser } from '../users/types/public-user.interface'
import { CoursesService } from './courses.service'
import type { CourseResponse } from './types/course-response.interface'

@Controller('courses')
@UseGuards(SessionAuthGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Courses retrieved successfully.')
  list(): Promise<CourseResponse[]> {
    return this.courses.listCatalog()
  }

  @Get('mine')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Courses retrieved successfully.')
  listMine(@CurrentUser() user: PublicUser): Promise<CourseResponse[]> {
    return this.courses.listMine(user)
  }

  @Get('template/:templateId')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course publications retrieved successfully.')
  listByTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseResponse[]> {
    return this.courses.listByTemplate(templateId, user)
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course retrieved successfully.')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseResponse> {
    return this.courses.getById(id, user)
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course unpublished successfully.')
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseResponse> {
    return this.courses.unpublish(id, user)
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course published successfully.')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseResponse> {
    return this.courses.publish(id, user)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course deleted successfully.')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<void> {
    await this.courses.remove(id, user)
  }
}
