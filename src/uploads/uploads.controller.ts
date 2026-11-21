import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import type { PublicUser } from '../users/types/public-user.interface'
import { assertTeacher } from '../courses/utils/role-guards'
import { StorageService } from '../storage/storage.service'
import { ImageCompressionService } from './image-compression.service'
import { VIDEO_EXTENSIONS } from './uploads.constants'
import type { UploadedFilePayload } from './uploads.types'
import { VideoCompressionService } from './video-compression.service'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 200 * 1024 * 1024

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

@Controller('uploads')
@UseGuards(SessionAuthGuard)
export class UploadsController {
  constructor(
    private readonly imageCompression: ImageCompressionService,
    private readonly videoCompression: VideoCompressionService,
    private readonly storage: StorageService,
  ) {}

  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  async uploadImage(
    @CurrentUser() user: PublicUser,
    @Body('courseId') courseId: string | undefined,
    @UploadedFile() file?: UploadedFilePayload,
  ): Promise<{ url: string }> {
    assertTeacher(user)

    if (!file) {
      throw new AppException(
        400,
        ErrorCodes.InvalidRequest,
        'Select an image to upload.',
      )
    }

    const extension = IMAGE_EXTENSIONS[file.mimetype]

    if (!extension) {
      throw new AppException(
        400,
        ErrorCodes.InvalidRequest,
        'Upload a PNG, JPG, WebP or GIF image.',
      )
    }

    if (file.size === 0) {
      throw new AppException(
        400,
        ErrorCodes.InvalidRequest,
        'The image is empty.',
      )
    }

    const compression = await this.imageCompression.compress(file)
    const outputExtension =
      IMAGE_EXTENSIONS[compression.mimetype] ?? extension
    const url = await this.storage.save({
      buffer: compression.buffer,
      courseId: courseId ?? '',
      kind: 'images',
      extension: outputExtension,
      contentType: compression.mimetype,
    })

    return { url }
  }

  @Post('video')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_BYTES } }),
  )
  async uploadVideo(
    @CurrentUser() user: PublicUser,
    @Body('courseId') courseId: string | undefined,
    @UploadedFile() file?: UploadedFilePayload,
  ): Promise<{ url: string }> {
    assertTeacher(user)

    if (!file) {
      throw new AppException(
        400,
        ErrorCodes.InvalidRequest,
        'Select a video to upload.',
      )
    }

    const extension = VIDEO_EXTENSIONS[file.mimetype]

    if (!extension) {
      throw new AppException(
        400,
        ErrorCodes.InvalidRequest,
        'Upload an MP4, WebM, OGG or MOV video.',
      )
    }

    if (file.size === 0) {
      throw new AppException(
        400,
        ErrorCodes.InvalidRequest,
        'The video is empty.',
      )
    }

    const compression = await this.videoCompression.compress(file)
    const outputExtension =
      VIDEO_EXTENSIONS[compression.mimetype] ?? extension
    const url = await this.storage.save({
      buffer: compression.buffer,
      courseId: courseId ?? '',
      kind: 'videos',
      extension: outputExtension,
      contentType: compression.mimetype,
    })

    return { url }
  }
}
