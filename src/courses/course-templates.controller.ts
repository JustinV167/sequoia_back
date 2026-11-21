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
import { CourseTemplatesService } from './course-templates.service'
import { CreateCourseDto } from './dto/create-course.dto'
import { PublishCourseTemplateDto } from './dto/publish-course-template.dto'
import { UpdateCourseDto } from './dto/update-course.dto'
import type { CourseResponse } from './types/course-response.interface'
import type { CourseTemplateResponse } from './types/course-template-response.interface'

@Controller('course-templates')
@UseGuards(SessionAuthGuard)
export class CourseTemplatesController {
  constructor(private readonly templates: CourseTemplatesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Course template created successfully.')
  create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseTemplateResponse> {
    return this.templates.create(user, dto)
  }

  @Get('mine')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course templates retrieved successfully.')
  listMine(@CurrentUser() user: PublicUser): Promise<CourseTemplateResponse[]> {
    return this.templates.listMine(user)
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course template retrieved successfully.')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseTemplateResponse> {
    return this.templates.getById(id, user)
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course template updated successfully.')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseTemplateResponse> {
    return this.templates.update(id, user, dto)
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Course template published successfully.')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishCourseTemplateDto,
    @CurrentUser() user: PublicUser,
  ): Promise<CourseResponse> {
    return this.templates.publish(id, user, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course template deleted successfully.')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<void> {
    await this.templates.remove(id, user)
  }
}
