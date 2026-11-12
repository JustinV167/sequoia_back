import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ErrorCodes } from '../common/constants/error-codes'
import { AppException } from '../common/exceptions/app.exception'
import { SessionAuthGuard } from '../auth/guards/session-auth.guard'
import type { PublicUser } from '../users/types/public-user.interface'
import { assertTeacher } from '../courses/utils/role-guards'
import { getUploadsDir } from './uploads.config'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

type UploadedImage = {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

@Controller('uploads')
@UseGuards(SessionAuthGuard)
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  async uploadImage(
    @CurrentUser() user: PublicUser,
    @UploadedFile() file?: UploadedImage,
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

    const uploadsDir = getUploadsDir(this.config)
    const filename = `${randomUUID()}.${extension}`

    await mkdir(uploadsDir, { recursive: true })
    await writeFile(join(uploadsDir, filename), file.buffer)

    return { url: `/uploads/${filename}` }
  }
}
