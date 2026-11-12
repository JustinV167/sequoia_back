import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'

import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ResponseMessage } from '../common/decorators/response-message.decorator'
import type { PublicUser } from '../users/types/public-user.interface'
import { CoursesService } from './courses.service'
import { CreateCourseDto } from './dto/create-course.dto'
import { UpdateCourseDto } from './dto/update-course.dto'
import type { CourseResponse } from './types/course-response.interface'

@Controller('courses')
@UseGuards(SessionAuthGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Course created successfully.')
  create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseResponse> {
    return this.courses.create(user, dto)
  }

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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course retrieved successfully.')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseResponse> {
    return this.courses.getById(id, user)
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course updated successfully.')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseResponse> {
    return this.courses.update(id, user, dto)
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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course deleted successfully.')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<void> {
    await this.courses.remove(id, user)
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
}
